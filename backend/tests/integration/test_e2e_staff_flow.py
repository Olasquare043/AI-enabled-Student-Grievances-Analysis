import uuid

from fastapi import status

from app.models.user import User

from .helpers import auth_headers, elevate_role, login, register_and_login


def test_e2e_staff_triage_and_resolution_flow(client, db_session):
    admin = register_and_login(
        client,
        email="e2e.admin.staffflow@example.com",
        first_name="Admin",
        last_name="Operator",
        matric_number="ADM/26/9100",
    )
    elevate_role(db_session, user_id=admin["id"], role_name="admin")
    admin["token"] = login(client, email="e2e.admin.staffflow@example.com")

    staff = register_and_login(
        client,
        email="e2e.staff@example.com",
        first_name="Staff",
        last_name="Operator",
        matric_number="STF/26/9101",
    )
    elevate_role(db_session, user_id=staff["id"], role_name="staff")
    staff["token"] = login(client, email="e2e.staff@example.com")
    staff_user = db_session.get(User, uuid.UUID(staff["id"]))
    assert staff_user is not None
    staff_user.department = "Bursary"
    db_session.add(staff_user)
    db_session.commit()

    student = register_and_login(
        client,
        email="e2e.student.staffflow@example.com",
        first_name="Flow",
        last_name="Student",
        matric_number="STD/26/9102",
    )

    grievance_response = client.post(
        "/grievances",
        json={
            "title": "Fee receipt unresolved",
            "description": "Bursary payment was successful but receipt is unavailable and clearance is blocked.",
            "category": "bursary",
            "is_anonymous": False,
        },
        headers=auth_headers(student["token"]),
    )
    assert grievance_response.status_code == status.HTTP_201_CREATED
    grievance_id = grievance_response.json()["id"]

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(admin["token"]),
    )
    assert departments_response.status_code == status.HTTP_200_OK
    department_id = next(
        item["id"] for item in departments_response.json() if item["code"] == "BURSARY"
    )

    route_response = client.post(
        f"/operations/grievances/{grievance_id}/route",
        json={
            "department_id": department_id,
            "assignee_user_id": staff["id"],
            "note": "Route to operations desk for immediate resolution.",
        },
        headers=auth_headers(admin["token"]),
    )
    assert route_response.status_code == status.HTTP_200_OK
    assert route_response.json()["assigned_to_user_id"] == staff["id"]

    queue_response = client.get("/grievances/queue", headers=auth_headers(staff["token"]))
    assert queue_response.status_code == status.HTTP_200_OK
    queue_ids = {item["id"] for item in queue_response.json()}
    assert grievance_id in queue_ids

    in_progress_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "in_progress"},
        headers=auth_headers(staff["token"]),
    )
    assert in_progress_response.status_code == status.HTTP_200_OK

    resolved_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={
            "status": "resolved",
            "resolution_note": "Payment record synchronized and receipt generated.",
        },
        headers=auth_headers(staff["token"]),
    )
    assert resolved_response.status_code == status.HTTP_200_OK
    assert resolved_response.json()["status"] == "resolved"

    comment_response = client.post(
        f"/grievances/{grievance_id}/comments",
        json={"body": "Please confirm receipt download from your dashboard."},
        headers=auth_headers(staff["token"]),
    )
    assert comment_response.status_code == status.HTTP_201_CREATED

    nlp_response = client.post(
        "/nlp/analyze",
        json={
            "text": "Tuition payment was successful but bursary receipt is still missing.",
            "include_llm_enrichment": False,
        },
        headers=auth_headers(staff["token"]),
    )
    assert nlp_response.status_code == status.HTTP_200_OK
    assert nlp_response.json()["predicted_category"]

    analytics_response = client.get(
        "/analytics/overview?period_days=30",
        headers=auth_headers(staff["token"]),
    )
    assert analytics_response.status_code == status.HTTP_200_OK
    assert analytics_response.json()["total_grievances"] >= 1
