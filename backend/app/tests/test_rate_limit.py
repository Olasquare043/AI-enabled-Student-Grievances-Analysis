import uuid

from app.main import app
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


def test_rate_limit_blocks_excess_requests(client):
    limiter = app.state.rate_limiter
    original_state = (limiter.enabled, limiter.max_requests, limiter.window_seconds)

    try:
        limiter.configure(enabled=True, max_requests=3, window_seconds=60)
        limiter.reset()

        headers = {"X-Forwarded-For": "203.0.113.9"}
        for _ in range(3):
            response = client.get("/auth/me", headers=headers)
            assert response.status_code == 401

        blocked = client.get("/auth/me", headers=headers)
        assert blocked.status_code == 429
        payload = blocked.json()
        assert payload["detail"] == "Rate limit exceeded"
        assert payload["retry_after_seconds"] >= 1
        assert int(blocked.headers["Retry-After"]) >= 1
    finally:
        limiter.configure(
            enabled=original_state[0],
            max_requests=original_state[1],
            window_seconds=original_state[2],
        )
        limiter.reset()


def test_rate_limit_is_scoped_per_client_identifier(client):
    limiter = app.state.rate_limiter
    original_state = (limiter.enabled, limiter.max_requests, limiter.window_seconds)

    try:
        limiter.configure(enabled=True, max_requests=2, window_seconds=60)
        limiter.reset()

        first_client_headers = {"X-Forwarded-For": "203.0.113.10"}
        second_client_headers = {"X-Forwarded-For": "203.0.113.11"}

        assert client.get("/auth/me", headers=first_client_headers).status_code == 401
        assert client.get("/auth/me", headers=first_client_headers).status_code == 401
        assert client.get("/auth/me", headers=first_client_headers).status_code == 429

        second_client_response = client.get("/auth/me", headers=second_client_headers)
        assert second_client_response.status_code == 401
    finally:
        limiter.configure(
            enabled=original_state[0],
            max_requests=original_state[1],
            window_seconds=original_state[2],
        )
        limiter.reset()


def test_monitoring_headers_and_metrics_endpoint(client, db_session):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.headers.get("X-Request-ID")
    assert health.headers.get("X-Process-Time-Ms")

    admin = register_and_login(
        client,
        email="monitoring.admin@example.com",
        first_name="Monitoring",
        last_name="Admin",
        matric_number="ADM/26/8801",
    )
    assign_role(db_session, uuid.UUID(admin["id"]), "admin")
    admin_login = client.post(
        "/auth/login",
        json={"email": "monitoring.admin@example.com", "password": "StrongPass123!"},
    )
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]

    metrics = client.get("/health/metrics", headers={"Authorization": f"Bearer {token}"})
    assert metrics.status_code == 200
    payload = metrics.json()
    assert payload["total_requests"] >= 1
    assert "status_counts" in payload
