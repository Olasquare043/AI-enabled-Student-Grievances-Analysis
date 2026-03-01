import uuid

from sqlalchemy import select

from app.models.role import Role
from app.services.user_service import assign_role, seed_roles


def test_role_seed_exists_and_is_idempotent(db_session):
    seed_roles(db_session)
    seed_roles(db_session)
    roles = db_session.scalars(select(Role)).all()
    role_names = {role.name for role in roles}
    assert role_names == {"student", "staff", "admin"}
    assert len(roles) == 3


def test_admin_can_assign_role(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "admin@example.com",
            "first_name": "System",
            "last_name": "Admin",
            "matric_number": "ADM/00/0001",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = uuid.UUID(admin_register_response.json()["id"])
    assign_role(db_session, admin_user_id, "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    target_register_response = client.post(
        "/auth/register",
        json={
            "email": "target@example.com",
            "first_name": "Target",
            "last_name": "User",
            "matric_number": "BIO/24/7777",
            "password": "StrongPass123!",
        },
    )
    target_user_id = target_register_response.json()["id"]

    assign_response = client.post(
        f"/users/{target_user_id}/roles",
        json={"role_name": "staff"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert assign_response.status_code == 200
    roles = {role["name"] for role in assign_response.json()["roles"]}
    assert "staff" in roles
