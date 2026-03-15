import uuid

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


def test_nlp_analysis_pipeline_returns_baseline_outputs(client, db_session):
    staff = register_and_login(
        client,
        email="nlp.staff@example.com",
        first_name="NLP",
        last_name="Staff",
        matric_number="STF/26/1001",
    )
    assign_role(db_session, uuid.UUID(staff["id"]), "staff")

    login_response = client.post(
        "/auth/login",
        json={"email": "nlp.staff@example.com", "password": "StrongPass123!"},
    )
    staff_token = login_response.json()["access_token"]

    response = client.post(
        "/nlp/analyze",
        json={
            "text": "Urgent bursary issue: tuition payment REF123456 was debited but receipt is still missing before exam deadline.",
            "include_llm_enrichment": False,
        },
        headers=auth_headers(staff_token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "none"
    assert payload["predicted_category"] in {
        "bursary",
        "ict",
        "registry",
        "hostel",
        "security",
        "academic",
        "welfare",
    }
    assert payload["category_confidence"] >= 0.0
    assert len(payload["category_suggestions"]) >= 1
    assert payload["sentiment"]["label"] in {"negative", "neutral", "positive"}
    assert payload["urgency"]["label"] in {"medium", "high", "critical"}
    assert isinstance(payload["entities"], dict)


def test_nlp_grievance_analysis_and_topic_clustering(client, db_session):
    admin = register_and_login(
        client,
        email="cluster.admin@example.com",
        first_name="Cluster",
        last_name="Admin",
        matric_number="ADM/26/1000",
    )
    assign_role(db_session, uuid.UUID(admin["id"]), "admin")
    admin_login = client.post(
        "/auth/login",
        json={"email": "cluster.admin@example.com", "password": "StrongPass123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    staff = register_and_login(
        client,
        email="cluster.staff@example.com",
        first_name="Cluster",
        last_name="Staff",
        matric_number="STF/26/1002",
    )
    assign_role(db_session, uuid.UUID(staff["id"]), "staff")
    staff_login = client.post(
        "/auth/login",
        json={"email": "cluster.staff@example.com", "password": "StrongPass123!"},
    )
    staff_token = staff_login.json()["access_token"]

    student = register_and_login(
        client,
        email="cluster.student@example.com",
        first_name="Cluster",
        last_name="Student",
        matric_number="STD/26/2001",
    )

    created_ids: list[str] = []
    grievances = [
        ("Portal error during payment", "Payment page crashes and returns timeout error.", "bursary"),
        ("Receipt not generated", "Bursary payment completed but receipt is missing.", "bursary"),
        ("Campus WiFi outage", "Internet access is down across the lecture hall.", "ict"),
        ("Portal login blocked", "Student portal rejects valid credentials repeatedly.", "ict"),
        ("Course registration failure", "Portal fails to save selected courses for semester.", "ict"),
    ]

    for title, description, category in grievances:
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
        created_ids.append(create_response.json()["id"])

    departments_response = client.get(
        "/operations/departments?active_only=true",
        headers=auth_headers(admin_token),
    )
    assert departments_response.status_code == 200
    bursary_department_id = next(
        item["id"] for item in departments_response.json() if item["code"] == "BURSARY"
    )

    route_response = client.post(
        f"/operations/grievances/{created_ids[0]}/route",
        json={"department_id": bursary_department_id, "assignee_user_id": staff["id"]},
        headers=auth_headers(admin_token),
    )
    assert route_response.status_code == 200

    analyze_response = client.post(
        f"/nlp/grievances/{created_ids[0]}/analyze",
        json={"include_llm_enrichment": False},
        headers=auth_headers(staff_token),
    )
    assert analyze_response.status_code == 200
    analyzed = analyze_response.json()
    assert analyzed["grievance_id"] == created_ids[0]
    assert analyzed["source_category"] == "bursary"
    assert analyzed["predicted_category"]

    cluster_response = client.post(
        "/nlp/cluster",
        json={"limit": 50},
        headers=auth_headers(staff_token),
    )
    assert cluster_response.status_code == 200
    clusters = cluster_response.json()
    assert len(clusters) >= 1
    assert all(cluster["size"] >= 1 for cluster in clusters)
    total_members = sum(cluster["size"] for cluster in clusters)
    assert total_members == len(created_ids)


def test_nlp_analyze_requires_staff_or_admin(client):
    student = register_and_login(
        client,
        email="nlp.student@example.com",
        first_name="NLP",
        last_name="Student",
        matric_number="STD/26/3001",
    )

    response = client.post(
        "/nlp/analyze",
        json={
            "text": "This is a valid grievance text requiring classification and analysis.",
            "include_llm_enrichment": False,
        },
        headers=auth_headers(student["token"]),
    )

    assert response.status_code == 403
