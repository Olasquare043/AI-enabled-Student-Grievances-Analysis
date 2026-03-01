from fastapi import status

from .helpers import auth_headers, elevate_role, login, register_and_login


def test_e2e_admin_governance_and_reporting_flow(client, db_session):
    admin = register_and_login(
        client,
        email="e2e.admin@example.com",
        first_name="Admin",
        last_name="Owner",
        matric_number="ADM/26/9201",
    )
    elevate_role(db_session, user_id=admin["id"], role_name="admin")
    admin["token"] = login(client, email="e2e.admin@example.com")

    managed_user = register_and_login(
        client,
        email="e2e.managed.user@example.com",
        first_name="Managed",
        last_name="User",
        matric_number="STD/26/9202",
    )

    list_users_response = client.get("/users", headers=auth_headers(admin["token"]))
    assert list_users_response.status_code == status.HTTP_200_OK
    listed_ids = {item["id"] for item in list_users_response.json()}
    assert managed_user["id"] in listed_ids

    assign_role_response = client.post(
        f"/users/{managed_user['id']}/roles",
        json={"role_name": "staff"},
        headers=auth_headers(admin["token"]),
    )
    assert assign_role_response.status_code == status.HTTP_200_OK
    assigned_roles = {role["name"] for role in assign_role_response.json()["roles"]}
    assert {"student", "staff"}.issubset(assigned_roles)

    metrics_response = client.get(
        "/health/metrics",
        headers=auth_headers(admin["token"]),
    )
    assert metrics_response.status_code == status.HTTP_200_OK
    metrics_payload = metrics_response.json()
    assert metrics_payload["total_requests"] >= 1
    assert "top_routes" in metrics_payload

    create_department_response = client.post(
        "/operations/departments",
        json={"name": "Quality Assurance", "code": "QASS"},
        headers=auth_headers(admin["token"]),
    )
    assert create_department_response.status_code == status.HTTP_201_CREATED
    department_id = create_department_response.json()["id"]

    policy_response = client.put(
        f"/operations/sla/policies/{department_id}",
        json={
            "first_response_minutes": 90,
            "resolution_minutes": 1440,
            "is_active": True,
        },
        headers=auth_headers(admin["token"]),
    )
    assert policy_response.status_code == status.HTTP_200_OK
    assert policy_response.json()["department_id"] == department_id

    escalation_rules_response = client.get(
        "/operations/escalation-rules",
        headers=auth_headers(admin["token"]),
    )
    assert escalation_rules_response.status_code == status.HTTP_200_OK
    assert len(escalation_rules_response.json()) >= 1

    analytics_clusters_response = client.get(
        "/analytics/topic-clusters?period_days=30",
        headers=auth_headers(admin["token"]),
    )
    assert analytics_clusters_response.status_code == status.HTTP_200_OK
    assert "clusters" in analytics_clusters_response.json()
