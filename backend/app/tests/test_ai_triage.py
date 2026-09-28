import uuid

from sqlalchemy import select

from app.ml.runtime import get_triage_engine
from app.models.audit_log import AuditLog
from app.models.sla_event import SLAEvent
from app.services.triage_service import compute_priority
from app.services.user_service import assign_role


def register_and_login(client, *, email: str, matric_number: str, password: str = "StrongPass123!") -> dict[str, str]:
    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "first_name": "Test",
            "last_name": "User",
            "matric_number": matric_number,
            "password": password,
        },
    )
    assert register_response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    assert login_response.status_code == 200
    return {"id": register_response.json()["id"], "token": login_response.json()["access_token"]}


def login_as(client, db_session, *, email: str, matric_number: str, role: str) -> str:
    user = register_and_login(client, email=email, matric_number=matric_number)
    assign_role(db_session, uuid.UUID(user["id"]), role)
    response = client.post("/auth/login", json={"email": email, "password": "StrongPass123!"})
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_trained_models_are_available():
    engine = get_triage_engine()
    assert engine.available
    assert 0.0 < engine.auto_route_threshold < 1.0
    assert engine.metrics is not None
    assert engine.metrics["classification"]["best_model"] == engine.model_name


def test_explanation_terms_come_from_the_text():
    engine = get_triage_engine()
    prediction = engine.classify(
        "Remita payment not confirmed",
        "I paid my school fees through Remita and the bank confirmed the debit, but the portal says I owe.",
    )
    assert prediction.label == "bursary"
    assert prediction.explanation
    text = "remita payment not confirmed paid school fees bank debit portal owe"
    for item in prediction.explanation:
        assert item.weight > 0
        assert all(token in text for token in item.term.split())


def test_priority_rule():
    assert compute_priority("critical", 0.0) == "P1"
    assert compute_priority("low", -1.0) == "P4"  # tone never raises a low-urgency case
    assert compute_priority("medium", -0.6) == "P2"
    assert compute_priority("high", 0.2) == "P2"


def test_confident_grievance_is_triaged_and_auto_routed(client, db_session):
    student = register_and_login(client, email="triage.student@example.com", matric_number="STD/26/3001")

    response = client.post(
        "/grievances",
        json={
            "title": "Remita payment not confirmed",
            "description": "I paid my school fees through Remita with my RRR and my bank confirmed the debit, "
            "but the bursary portal still shows that I owe. Registration closes this week.",
        },
        headers=auth_headers(student["token"]),
    )
    assert response.status_code == 201
    grievance = response.json()

    assert grievance["predicted_category"] == "bursary"
    assert grievance["category"] == "bursary"
    assert grievance["category_confidence"] >= get_triage_engine().auto_route_threshold
    assert grievance["auto_routed"] is True
    assert grievance["department"]["code"] == "BURSARY"
    assert grievance["priority"] in {"P1", "P2", "P3", "P4"}
    assert grievance["ai_explanation"]["top_terms"]
    assert grievance["topic_id"] is not None

    events = db_session.scalars(
        select(SLAEvent).where(SLAEvent.grievance_id == uuid.UUID(grievance["id"]))
    ).all()
    assert {event.event_type for event in events} >= {"first_response_deadline", "resolution_deadline"}


def test_vague_grievance_waits_for_human_routing(client):
    student = register_and_login(client, email="vague.student@example.com", matric_number="STD/26/3002")

    response = client.post(
        "/grievances",
        json={
            "title": "Complaint",
            "description": "I have been going up and down about this matter and nobody is attending to me.",
            "category": "other",
        },
        headers=auth_headers(student["token"]),
    )
    assert response.status_code == 201
    grievance = response.json()
    assert grievance["auto_routed"] is False
    assert grievance["department"] is None
    assert grievance["category_confidence"] < get_triage_engine().auto_route_threshold
    assert grievance["ai_explanation"]["student_category"] == "other"


def test_category_override_is_audited_and_staff_only(client, db_session):
    student = register_and_login(client, email="override.student@example.com", matric_number="STD/26/3003")
    admin_token = login_as(client, db_session, email="override.admin@example.com",
                           matric_number="ADM/26/3004", role="admin")

    created = client.post(
        "/grievances",
        json={
            "title": "Portal error during payment",
            "description": "The payment page crashes and returns a timeout error when I try to pay my fees.",
        },
        headers=auth_headers(student["token"]),
    ).json()

    forbidden = client.patch(
        f"/grievances/{created['id']}/category",
        json={"category": "bursary"},
        headers=auth_headers(student["token"]),
    )
    assert forbidden.status_code == 403

    target = "ict" if created["category"] != "ict" else "bursary"
    updated = client.patch(
        f"/grievances/{created['id']}/category",
        json={"category": target},
        headers=auth_headers(admin_token),
    )
    assert updated.status_code == 200
    assert updated.json()["category"] == target

    logs = db_session.scalars(
        select(AuditLog).where(AuditLog.action == "grievance.category_overridden")
    ).all()
    assert len(logs) == 1
    assert logs[0].details["to_category"] == target
    assert logs[0].details["predicted_category"] == created["predicted_category"]


def test_topic_trends_and_model_card(client, db_session):
    student = register_and_login(client, email="card.student@example.com", matric_number="STD/26/3005")
    admin_token = login_as(client, db_session, email="card.admin@example.com",
                           matric_number="ADM/26/3006", role="admin")
    for _ in range(3):
        client.post(
            "/grievances",
            json={
                "title": "No water in the hostel",
                "description": "There has been no running water in Moremi Hall for five days since the borehole broke down.",
            },
            headers=auth_headers(student["token"]),
        )

    assert client.get("/analytics/model-card", headers=auth_headers(student["token"])).status_code == 403

    card = client.get("/analytics/model-card", headers=auth_headers(admin_token))
    assert card.status_code == 200
    body = card.json()
    assert body["available"] is True
    assert {model["name"] for model in body["models"]} >= {"Logistic Regression", "Linear SVM"}
    assert body["live"]["triaged_grievances"] == 3
    assert body["topics"]["best_k"] >= 8

    trends = client.get("/analytics/topic-trends?period_days=30", headers=auth_headers(admin_token))
    assert trends.status_code == 200
    payload = trends.json()
    assert payload["weeks"]
    assert sum(topic["count"] for topic in payload["topics"]) == 3
    assert all(len(topic["weekly_counts"]) == len(payload["weeks"]) for topic in payload["topics"])
