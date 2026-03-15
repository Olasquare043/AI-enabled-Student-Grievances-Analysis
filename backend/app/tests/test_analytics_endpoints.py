import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.sla_event import SLAEvent
from app.services.sla_service import (
    SLA_EVENT_ESCALATION,
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
    SLA_STATUS_BREACHED,
    SLA_STATUS_MET,
    SLA_STATUS_TRIGGERED,
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


def bootstrap_staff(client, db_session) -> dict[str, str]:
    staff = register_and_login(
        client,
        email="analytics.staff@example.com",
        first_name="Analytics",
        last_name="Staff",
        matric_number="STF/26/7001",
    )
    assign_role(db_session, uuid.UUID(staff["id"]), "staff")
    login_response = client.post(
        "/auth/login",
        json={"email": "analytics.staff@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == 200
    staff["token"] = login_response.json()["access_token"]
    return staff


def bootstrap_admin(client, db_session) -> dict[str, str]:
    admin = register_and_login(
        client,
        email="analytics.admin@example.com",
        first_name="Analytics",
        last_name="Admin",
        matric_number="ADM/26/7000",
    )
    assign_role(db_session, uuid.UUID(admin["id"]), "admin")
    login_response = client.post(
        "/auth/login",
        json={"email": "analytics.admin@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == 200
    admin["token"] = login_response.json()["access_token"]
    return admin


def test_analytics_endpoints_require_staff_or_admin(client):
    student = register_and_login(
        client,
        email="analytics.student@example.com",
        first_name="Analytics",
        last_name="Student",
        matric_number="STD/26/7001",
    )

    overview_response = client.get(
        "/analytics/overview",
        headers=auth_headers(student["token"]),
    )
    assert overview_response.status_code == 403

    clusters_response = client.get(
        "/analytics/topic-clusters",
        headers=auth_headers(student["token"]),
    )
    assert clusters_response.status_code == 403


def test_analytics_overview_returns_metrics(client, db_session):
    admin = bootstrap_admin(client, db_session)
    staff = bootstrap_staff(client, db_session)
    student = register_and_login(
        client,
        email="analytics.metrics.student@example.com",
        first_name="Metrics",
        last_name="Student",
        matric_number="STD/26/7002",
    )

    grievance_specs = [
        (
            "Payment receipt missing",
            "I completed tuition payment but receipt has not been generated.",
            "bursary",
        ),
        (
            "WiFi outage in faculty block",
            "Campus internet has been down since yesterday and classes are affected.",
            "ict",
        ),
        (
            "Portal registration error",
            "Course registration keeps failing with timeout errors.",
            "ict",
        ),
    ]

    grievance_ids: list[str] = []
    for title, description, category in grievance_specs:
        create_response = client.post(
            "/grievances",
            json={
                "title": title,
                "description": description,
                "category": category,
                "is_anonymous": False,
            },
            headers=auth_headers(student["token"]),
        )
        assert create_response.status_code == 201
        grievance_ids.append(create_response.json()["id"])

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(admin["token"]),
    )
    assert departments_response.status_code == 200
    department_id = departments_response.json()[0]["id"]

    route_response = client.post(
        f"/operations/grievances/{grievance_ids[0]}/route",
        json={
            "department_id": department_id,
            "assignee_user_id": staff["id"],
        },
        headers=auth_headers(admin["token"]),
    )
    assert route_response.status_code == 200

    resolve_response = client.patch(
        f"/grievances/{grievance_ids[0]}/status",
        json={
            "status": "in_progress",
        },
        headers=auth_headers(staff["token"]),
    )
    assert resolve_response.status_code == 200
    resolve_response = client.patch(
        f"/grievances/{grievance_ids[0]}/status",
        json={
            "status": "resolved",
            "resolution_note": "Issue resolved by restoring billing sync.",
        },
        headers=auth_headers(staff["token"]),
    )
    assert resolve_response.status_code == 200

    routed_events = list(
        db_session.scalars(
            select(SLAEvent).where(
                SLAEvent.grievance_id == uuid.UUID(grievance_ids[0]),
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
        )
    )
    assert routed_events

    now = datetime.now(UTC)
    breached_event: SLAEvent | None = None
    for event in routed_events:
        if event.event_type == SLA_EVENT_FIRST_RESPONSE_DEADLINE:
            event.status = SLA_STATUS_MET
            event.occurred_at = now
            db_session.add(event)
        if event.event_type == SLA_EVENT_RESOLUTION_DEADLINE:
            event.status = SLA_STATUS_BREACHED
            event.due_at = now - timedelta(hours=3)
            event.occurred_at = now - timedelta(hours=2)
            db_session.add(event)
            breached_event = event
    assert breached_event is not None

    db_session.add(
        SLAEvent(
            grievance_id=uuid.UUID(grievance_ids[0]),
            department_id=department_id,
            policy_id=breached_event.policy_id,
            parent_event_id=breached_event.id,
            event_type=SLA_EVENT_ESCALATION,
            status=SLA_STATUS_TRIGGERED,
            due_at=now - timedelta(hours=1),
            occurred_at=now,
            details={"reason": "deadline_breach"},
        )
    )
    db_session.commit()

    overview_response = client.get(
        "/analytics/overview?period_days=30",
        headers=auth_headers(staff["token"]),
    )
    assert overview_response.status_code == 200
    payload = overview_response.json()

    assert payload["period_days"] == 30
    assert payload["total_grievances"] == 3
    assert len(payload["volume_trend"]) == 30
    assert payload["backlog"]["total_backlog"] >= 1
    assert payload["resolution"]["resolved_count"] >= 1
    assert payload["escalation_events"] >= 1
    assert payload["active_breaches"] >= 1

    categories = {item["category"]: item["count"] for item in payload["category_distribution"]}
    assert categories["ict"] == 2
    assert categories["bursary"] == 1

    compliance = {item["breach_type"]: item for item in payload["sla_compliance"]}
    assert "first_response" in compliance
    assert "resolution" in compliance
    assert compliance["first_response"]["met_count"] >= 1
    assert compliance["resolution"]["breached_count"] >= 1

    assert len(payload["department_hotspots"]) >= 1
    assert len(payload["faculty_hotspots"]) >= 1


def test_analytics_topic_clusters_returns_cluster_insights(client, db_session):
    staff = bootstrap_staff(client, db_session)
    student = register_and_login(
        client,
        email="analytics.cluster.student@example.com",
        first_name="Cluster",
        last_name="Student",
        matric_number="STD/26/7003",
    )

    complaints = [
        (
            "Portal login fails repeatedly",
            "Student portal rejects login and says invalid token.",
            "ict",
        ),
        (
            "Portal page timeout",
            "The registration page keeps timing out on submit.",
            "ict",
        ),
        (
            "Bursary receipt delay",
            "Tuition payment is confirmed but receipt is still unavailable.",
            "bursary",
        ),
        (
            "Bursary payment mismatch",
            "Payment status in bursary office does not match my debit alert.",
            "bursary",
        ),
    ]

    for title, description, category in complaints:
        response = client.post(
            "/grievances",
            json={
                "title": title,
                "description": description,
                "category": category,
                "is_anonymous": False,
            },
            headers=auth_headers(student["token"]),
        )
        assert response.status_code == 201

    clusters_response = client.get(
        "/analytics/topic-clusters?period_days=30",
        headers=auth_headers(staff["token"]),
    )
    assert clusters_response.status_code == 200
    payload = clusters_response.json()
    assert payload["period_days"] == 30
    assert len(payload["clusters"]) >= 1

    first_cluster = payload["clusters"][0]
    assert first_cluster["size"] >= 1
    assert len(first_cluster["top_keywords"]) >= 1
    assert len(first_cluster["member_ids"]) >= 1
    assert len(first_cluster["sample_titles"]) >= 1
