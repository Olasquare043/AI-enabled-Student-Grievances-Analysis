from fastapi import status


def test_section01_api_smoke(client):
    health_response = client.get("/health")
    assert health_response.status_code == status.HTTP_200_OK
    assert health_response.json() == {"status": "ok"}

    register_response = client.post(
        "/auth/register",
        json={
            "email": "smoke.student@example.com",
            "first_name": "Smoke",
            "last_name": "Tester",
            "matric_number": "SMK/26/0001",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == status.HTTP_201_CREATED

    login_response = client.post(
        "/auth/login",
        json={"email": "smoke.student@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == status.HTTP_200_OK
    login_payload = login_response.json()
    assert login_payload["token_type"] == "bearer"
    assert isinstance(login_payload["access_token"], str)
    assert login_payload["access_token"]

    me_with_cookie = client.get("/auth/me")
    assert me_with_cookie.status_code == status.HTTP_200_OK
    assert me_with_cookie.json()["email"] == "smoke.student@example.com"

    update_response = client.patch(
        "/users/me",
        json={"faculty": "Engineering", "department": "Computer Science", "level": "300"},
    )
    assert update_response.status_code == status.HTTP_200_OK
    assert update_response.json()["department"] == "Computer Science"

    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == status.HTTP_204_NO_CONTENT

    me_after_logout = client.get("/auth/me")
    assert me_after_logout.status_code == status.HTTP_401_UNAUTHORIZED
