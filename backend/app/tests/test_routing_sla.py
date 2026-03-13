import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.sla_event import SLAEvent
from app.services.sla_service import (
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
)
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

    return {
        "id": register_response.json()["id"],
        "token": login_response.json()["access_token"],
    }


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def bootstrap_admin(client, db_session) -> dict[str, str]:
    admin = register_and_login(
        client,
        email="ops.admin@example.com",
        first_name="Ops",
        last_name="Admin",
        matric_number="ADM/26/0001",
    )
    assign_role(db_session, uuid.UUID(admin["id"]), "admin")
    login_response = client.post(
        "/auth/login",
        json={"email": "ops.admin@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == 200
    admin["token"] = login_response.json()["access_token"]
    return admin


def bootstrap_staff(client, db_session) -> dict[str, str]:
    staff = register_and_login(
        client,
        email="ops.staff@example.com",
        first_name="Ops",
        last_name="Staff",
        matric_number="STF/26/0001",
    )
    assign_role(db_session, uuid.UUID(staff["id"]), "staff")
    login_response = client.post(
        "/auth/login",
        json={"email": "ops.staff@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == 200
    staff["token"] = login_response.json()["access_token"]
    return staff


def test_operations_departments_and_policy_admin_controls(client, db_session):
    admin = bootstrap_admin(client, db_session)

    departments_response = client.get(
        "/operations/departments",
        headers=auth_headers(admin["token"]),
    )
    assert departments_response.status_code == 200
    departments = departments_response.json()
    assert len(departments) >= 5
    department_codes = {item["code"] for item in departments}
    assert {"ICT", "BURSARY", "REGISTRY", "HOSTEL", "SECURITY"}.issubset(department_codes)

    policies_response = client.get(
        "/operations/sla/policies",
        headers=auth_headers(admin["token"]),
    )
    assert policies_response.status_code == 200
    policies = policies_response.json()
    assert len(policies) >= 5

    target_department_id = departments[0]["id"]
    update_policy_response = client.put(
        f"/operations/sla/policies/{target_department_id}",
        json={
            "first_response_minutes": 45,
            "resolution_minutes": 360,
            "is_active": True,
        },
        headers=auth_headers(admin["token"]),
    )
    assert update_policy_response.status_code == 200
    updated_policy = update_policy_response.json()
    assert updated_policy["first_response_minutes"] == 45
    assert updated_policy["resolution_minutes"] == 360

    rules_response = client.get(
        "/operations/escalation-rules",
        headers=auth_headers(admin["token"]),
    )
    assert rules_response.status_code == 200
    assert len(rules_response.json()) >= 2


def test_staff_can_route_grievance_and_operations_queue_shows_sla(client, db_session):
    admin = bootstrap_admin(client, db_session)
    staff = bootstrap_staff(client, db_session)
    student = register_and_login(
        client,
        email="ops.student@example.com",
        first_name="Ops",
        last_name="Student",
        matric_number="STD/26/0101",
    )

    grievance_response = client.post(
        "/grievances",
        json={
            "title": "Hostel maintenance delay",
            "description": "Hostel room plumbing has not been fixed for one week.",
            "category": "hostel",
            "is_anonymous": False,
        },
        headers=auth_headers(student["token"]),
    )
    assert grievance_response.status_code == 201
    grievance_id = grievance_response.json()["id"]

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(staff["token"]),
    )
    assert departments_response.status_code == 200
    department_id = departments_response.json()[0]["id"]

    route_response = client.post(
        f"/operations/grievances/{grievance_id}/route",
        json={
            "department_id": department_id,
            "assignee_user_id": staff["id"],
            "note": "Routing to operations staff for first action",
        },
        headers=auth_headers(staff["token"]),
    )
    assert route_response.status_code == 200
    routed = route_response.json()
    assert routed["department_id"] == department_id
    assert routed["assigned_to_user_id"] == staff["id"]

    assignments_response = client.get(
        f"/operations/grievances/{grievance_id}/assignments",
        headers=auth_headers(admin["token"]),
    )
    assert assignments_response.status_code == 200
    assignments = assignments_response.json()
    assert len(assignments) == 1
    assert assignments[0]["department_id"] == department_id

    queue_response = client.get(
        "/operations/queue",
        headers=auth_headers(staff["token"]),
    )
    assert queue_response.status_code == 200
    queue_items = queue_response.json()
    matched = next(item for item in queue_items if item["id"] == grievance_id)
    assert matched["first_response_status"] in {"pending", "met"}
    assert matched["resolution_status"] in {"pending", "met"}


def test_routed_case_breaches_sla_and_triggers_escalation(client, db_session):
    admin = bootstrap_admin(client, db_session)
    staff = bootstrap_staff(client, db_session)
    student = register_and_login(
        client,
        email="breach.student@example.com",
        first_name="Breach",
        last_name="Student",
        matric_number="STD/26/0555",
    )

    grievance_response = client.post(
        "/grievances",
        json={
            "title": "Persistent network outage",
            "description": "Department network has failed for many days with no update.",
            "category": "ict",
            "is_anonymous": True,
        },
        headers=auth_headers(student["token"]),
    )
    assert grievance_response.status_code == 201
    grievance_id = grievance_response.json()["id"]

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(admin["token"]),
    )
    department_id = departments_response.json()[0]["id"]

    update_policy_response = client.put(
        f"/operations/sla/policies/{department_id}",
        json={
            "first_response_minutes": 1,
            "resolution_minutes": 1,
            "is_active": True,
        },
        headers=auth_headers(admin["token"]),
    )
    assert update_policy_response.status_code == 200

    route_response = client.post(
        f"/operations/grievances/{grievance_id}/route",
        json={"department_id": department_id, "assignee_user_id": staff["id"]},
        headers=auth_headers(staff["token"]),
    )
    assert route_response.status_code == 200

    deadline_events = list(
        db_session.scalars(
            select(SLAEvent).where(
                SLAEvent.grievance_id == uuid.UUID(grievance_id),
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
        )
    )
    assert len(deadline_events) == 2

    past_due_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    for event in deadline_events:
        event.due_at = past_due_time
        db_session.add(event)
    db_session.commit()

    evaluate_response = client.post(
        "/operations/sla/evaluate",
        headers=auth_headers(staff["token"]),
    )
    assert evaluate_response.status_code == 200
    evaluate_payload = evaluate_response.json()
    assert evaluate_payload["new_breaches"] >= 2
    assert evaluate_payload["new_escalations"] >= 2

    breaches_response = client.get(
        "/operations/sla/breaches",
        headers=auth_headers(admin["token"]),
    )
    assert breaches_response.status_code == 200
    breaches = [
        item
        for item in breaches_response.json()
        if item["grievance_id"] == grievance_id
    ]
    assert len(breaches) >= 2
    assert all(item["escalation_count"] >= 1 for item in breaches)
    assert all(item["grievance_title"] == "Persistent network outage" for item in breaches)
    assert all(item["student"]["email"] == "breach.student@example.com" for item in breaches)

    queue_response = client.get(
        "/operations/queue",
        headers=auth_headers(staff["token"]),
    )
    assert queue_response.status_code == 200
    queue_item = next(item for item in queue_response.json() if item["id"] == grievance_id)
    assert queue_item["has_active_breach"] is True
    assert queue_item["escalation_count"] >= 2


def test_resolved_case_is_removed_from_active_breaches(client, db_session):
    admin = bootstrap_admin(client, db_session)
    staff = bootstrap_staff(client, db_session)
    student = register_and_login(
        client,
        email="resolved.breach.student@example.com",
        first_name="Resolved",
        last_name="Student",
        matric_number="STD/26/0666",
    )

    grievance_response = client.post(
        "/grievances",
        json={
            "title": "Transcript delay",
            "description": "My transcript request has been pending without any update.",
            "category": "registry",
            "is_anonymous": False,
        },
        headers=auth_headers(student["token"]),
    )
    assert grievance_response.status_code == 201
    grievance_id = grievance_response.json()["id"]

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(admin["token"]),
    )
    department_id = departments_response.json()[0]["id"]

    update_policy_response = client.put(
        f"/operations/sla/policies/{department_id}",
        json={
            "first_response_minutes": 1,
            "resolution_minutes": 1,
            "is_active": True,
        },
        headers=auth_headers(admin["token"]),
    )
    assert update_policy_response.status_code == 200

    route_response = client.post(
        f"/operations/grievances/{grievance_id}/route",
        json={"department_id": department_id, "assignee_user_id": staff["id"]},
        headers=auth_headers(staff["token"]),
    )
    assert route_response.status_code == 200

    deadline_events = list(
        db_session.scalars(
            select(SLAEvent).where(
                SLAEvent.grievance_id == uuid.UUID(grievance_id),
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
        )
    )
    past_due_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    for event in deadline_events:
        event.due_at = past_due_time
        db_session.add(event)
    db_session.commit()

    evaluate_response = client.post(
        "/operations/sla/evaluate",
        headers=auth_headers(staff["token"]),
    )
    assert evaluate_response.status_code == 200

    in_progress_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={"status": "in_progress"},
        headers=auth_headers(staff["token"]),
    )
    assert in_progress_response.status_code == 200

    resolve_response = client.patch(
        f"/grievances/{grievance_id}/status",
        json={
            "status": "resolved",
            "resolution_note": "Registry completed the transcript request.",
        },
        headers=auth_headers(staff["token"]),
    )
    assert resolve_response.status_code == 200

    breaches_response = client.get(
        "/operations/sla/breaches",
        headers=auth_headers(admin["token"]),
    )
    assert breaches_response.status_code == 200
    remaining = [
        item
        for item in breaches_response.json()
        if item["grievance_id"] == grievance_id
    ]
    assert remaining == []
