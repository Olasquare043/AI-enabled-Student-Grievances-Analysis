def test_register_login_and_me_flow(client):
    register_response = client.post(
        "/auth/register",
        json={
            "email": "student@example.com",
            "first_name": "David",
            "last_name": "Eze",
            "matric_number": "CSC/24/1001",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == 201
    register_body = register_response.json()
    assert register_body["email"] == "student@example.com"
    assert register_body["first_name"] == "David"
    assert register_body["matric_number"] == "CSC/24/1001"
    assert any(role["name"] == "student" for role in register_body["roles"])

    login_response = client.post(
        "/auth/login",
        json={
            "email": "student@example.com",
            "password": "StrongPass123!",
        },
    )
    assert login_response.status_code == 200
    login_body = login_response.json()
    assert login_body["token_type"] == "bearer"
    assert isinstance(login_body["access_token"], str)
    assert login_body["access_token"]

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login_body['access_token']}"},
    )
    assert me_response.status_code == 200
    me_body = me_response.json()
    assert me_body["email"] == "student@example.com"


def test_auth_me_rejects_missing_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_admin_route_rejects_student(client):
    client.post(
        "/auth/register",
        json={
            "email": "student2@example.com",
            "first_name": "Amara",
            "last_name": "Ifeanyi",
            "matric_number": "EEE/24/0999",
            "password": "StrongPass123!",
        },
    )
    login_response = client.post(
        "/auth/login",
        json={"email": "student2@example.com", "password": "StrongPass123!"},
    )
    access_token = login_response.json()["access_token"]

    users_response = client.get(
        "/users",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert users_response.status_code == 403


def test_user_can_update_profile_from_dashboard(client):
    client.post(
        "/auth/register",
        json={
            "email": "profile@example.com",
            "first_name": "Ibrahim",
            "last_name": "Bello",
            "matric_number": "MTH/23/0200",
            "password": "StrongPass123!",
        },
    )
    login_response = client.post(
        "/auth/login",
        json={"email": "profile@example.com", "password": "StrongPass123!"},
    )
    access_token = login_response.json()["access_token"]

    update_response = client.patch(
        "/users/me",
        json={
            "first_name": "Ada",
            "last_name": "Okafor",
            "matric_number": "CSC/23/0012",
            "faculty": "Engineering",
            "department": "Computer Science",
            "level": "300",
            "phone_number": "+2348000000000",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["first_name"] == "Ada"
    assert payload["matric_number"] == "CSC/23/0012"

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["department"] == "Computer Science"
