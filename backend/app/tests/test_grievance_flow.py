import uuid

from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.services.user_service import assign_role


def register_and_login(
    client,
    *,
    email: str,
    first_name: str,
    last_name: str,
    matric_number: str,
    password: str = "StrongPass123!",
) -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "matric_number": matric_number,
            "password": password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    return {
        "id": register_response.json()["id"],
        "token": token,
        "email": email,
    }


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_student_submit_track_comment_and_audit(client, db_session):
    student = register_and_login(
        client,
        email="grievance.student@example.com",
        first_name="Amina",
        last_name="Yusuf",
        matric_number="CSC/25/0101",
    )

    create_response = client.post(
        "/grievances",
        json={
            "title": "Portal payment error",
            "description": "Tuition payment shows successful but receipt did not generate.",
            "category": "bursary",
            "is_anonymous": False,
        },
        headers=auth_headers(student["token"]),
    )
    assert create_response.status_code == 201
    created = create_response.json()
    grievance_id = created["id"]
    assert created["status"] == "open"

    list_response = client.get("/grievances", headers=auth_headers(student["token"]))
    assert list_response.status_code == 200
    grievances = list_response.json()
    assert len(grievances) == 1
    assert grievances[0]["id"] == grievance_id

    detail_response = client.get(
        f"/grievances/{grievance_id}",
        headers=auth_headers(student["token"]),
    )
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["status_history"][0]["to_status"] == "open"
    assert detail["student"]["email"] == student["email"]

    comment_response = client.post(
        f"/grievances/{grievance_id}/comments",
        json={"body": "Please help before registration deadline."},
        headers=auth_headers(student["token"]),
    )
    assert comment_response.status_code == 201
    assert comment_response.json()["body"] == "Please help before registration deadline."

    comments_response = client.get(
        f"/grievances/{grievance_id}/comments",
        headers=auth_headers(student["token"]),
    )
    assert comments_response.status_code == 200
    assert len(comments_response.json()) == 1

    audit_actions = set(db_session.scalars(select(AuditLog.action)).all())
    assert "grievance.created" in audit_actions
    assert "grievance.comment_added" in audit_actions


def test_student_cannot_access_other_student_grievance(client):
    student_one = register_and_login(
        client,
        email="owner.student@example.com",
        first_name="Owner",
        last_name="Student",
        matric_number="MTH/25/1001",
    )
    student_two = register_and_login(
        client,
        email="other.student@example.com",
        first_name="Other",
        last_name="Student",
        matric_number="PHY/25/1002",
    )

    create_response = client.post(
        "/grievances",
        json={
            "title": "Hostel access issue",
            "description": "Entry card is blocked after payment confirmation.",
            "category": "hostel",
            "is_anonymous": False,
        },
        headers=auth_headers(student_one["token"]),
    )
    grievance_id = create_response.json()["id"]

    forbidden_detail = client.get(
        f"/grievances/{grievance_id}",
        headers=auth_headers(student_two["token"]),
    )
    assert forbidden_detail.status_code == 403

    list_response = client.get("/grievances", headers=auth_headers(student_two["token"]))
    assert list_response.status_code == 200
    assert list_response.json() == []

    forbidden_comment = client.post(
        f"/grievances/{grievance_id}/comments",
        json={"body": "I cannot see this."},
        headers=auth_headers(student_two["token"]),
    )
    assert forbidden_comment.status_code == 403


def test_staff_can_triage_assign_and_resolve(client, db_session):
    student = register_and_login(
        client,
        email="triage.student@example.com",
        first_name="Triage",
        last_name="Student",
        matric_number="EEE/25/9011",
    )

    create_response = client.post(
        "/grievances",
        json={
            "title": "Network outage in lab",
            "description": "Lab network has been down for three days and exams are near.",
            "category": "ict",
            "is_anonymous": True,
        },
        headers=auth_headers(student["token"]),
    )
    grievance_id = create_response.json()["id"]

    staff = register_and_login(
        client,
        email="staff.agent@example.com",
        first_name="Staff",
        last_name="Agent",
        matric_number="STAFF/25/0001",
    )
    assign_role(db_session, uuid.UUID(staff["id"]), "staff")

    queue_response = client.get("/grievances/queue", headers=auth_headers(staff["token"]))
    assert queue_response.status_code == 200
    queue_items = queue_response.json()
    assert len(queue_items) == 1
    assert queue_items[0]["id"] == grievance_id

    assign_response = client.post(
        f"/grievances/{grievance_id}/assign",
        json={"assignee_user_id": staff["id"]},
        headers=auth_headers(staff["token"]),
    )
    assert assign_response.status_code == 200
    assert assign_response.json()["assigned_to_user_id"] == staff["id"]

    in_progress_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "in_progress"},
        headers=auth_headers(staff["token"]),
    )
    assert in_progress_response.status_code == 200
    assert in_progress_response.json()["status"] == "in_progress"

    invalid_transition = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "open"},
        headers=auth_headers(staff["token"]),
    )
    assert invalid_transition.status_code == 400

    missing_resolution_note = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "resolved"},
        headers=auth_headers(staff["token"]),
    )
    assert missing_resolution_note.status_code == 400

    resolve_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "resolved", "resolution_note": "ICT restored connectivity and reset routers."},
        headers=auth_headers(staff["token"]),
    )
    assert resolve_response.status_code == 200
    resolved_payload = resolve_response.json()
    assert resolved_payload["status"] == "resolved"
    assert resolved_payload["resolution_note"] == "ICT restored connectivity and reset routers."

    detail_response = client.get(
        f"/grievances/{grievance_id}",
        headers=auth_headers(staff["token"]),
    )
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["status"] == "resolved"
    assert len(detail_payload["status_history"]) == 3

    audit_actions = set(db_session.scalars(select(AuditLog.action)).all())
    assert "grievance.assigned" in audit_actions
    assert "grievance.status_changed" in audit_actions


def test_triage_queue_requires_staff_or_admin(client):
    student = register_and_login(
        client,
        email="queue.student@example.com",
        first_name="Queue",
        last_name="Student",
        matric_number="CHM/25/3001",
    )

    queue_response = client.get("/grievances/queue", headers=auth_headers(student["token"]))
    assert queue_response.status_code == 403
