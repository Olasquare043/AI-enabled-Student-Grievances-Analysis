import uuid

from sqlalchemy.orm import Session

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

    payload = register_response.json()
    return {
        "id": payload["id"],
        "email": payload["email"],
        "token": login_response.json()["access_token"],
    }


def login(
    client,
    *,
    email: str,
    password: str = "StrongPass123!",
) -> str:
    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    return login_response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def elevate_role(
    db_session: Session,
    *,
    user_id: str,
    role_name: str,
) -> None:
    assign_role(db_session, uuid.UUID(user_id), role_name)
