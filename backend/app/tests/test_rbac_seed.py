import uuid

from sqlalchemy import select

from app.models.role import Role
from app.models.user import User
from app.services.user_service import (
    assign_role,
    get_role_by_name,
    normalize_all_user_roles,
    normalize_user_roles,
    seed_roles,
)


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
    assert roles == {"staff"}


def test_admin_can_create_user_from_users_endpoint(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "creator-admin@example.com",
            "first_name": "Creator",
            "last_name": "Admin",
            "matric_number": "ADM/24/0200",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = uuid.UUID(admin_register_response.json()["id"])
    assign_role(db_session, admin_user_id, "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "creator-admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    create_response = client.post(
        "/users",
        json={
            "email": "new-staff@example.com",
            "password": "StrongPass123!",
            "role_name": "staff",
            "first_name": "New",
            "last_name": "Staff",
            "matric_number": "OPS/24/4401",
            "faculty": "Administration",
            "department": "Student Affairs",
            "level": "N/A",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["email"] == "new-staff@example.com"
    assert payload["department"] == "Student Affairs"
    assert {role["name"] for role in payload["roles"]} == {"staff"}


def test_admin_can_update_and_delete_user_from_users_endpoint(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "manager-admin@example.com",
            "first_name": "Manager",
            "last_name": "Admin",
            "matric_number": "ADM/24/0300",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = uuid.UUID(admin_register_response.json()["id"])
    assign_role(db_session, admin_user_id, "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "manager-admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    create_response = client.post(
        "/users",
        json={
            "email": "editable@example.com",
            "password": "StrongPass123!",
            "role_name": "student",
            "first_name": "Editable",
            "last_name": "User",
            "matric_number": "CSC/24/5501",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    target_user_id = create_response.json()["id"]

    update_response = client.put(
        f"/users/{target_user_id}",
        json={
            "email": "updated@example.com",
            "role_name": "staff",
            "first_name": "Updated",
            "last_name": "User",
            "matric_number": "OPS/24/5501",
            "faculty": "Administration",
            "department": "Student Affairs",
            "level": "N/A",
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_response.status_code == 200
    updated_payload = update_response.json()
    assert updated_payload["email"] == "updated@example.com"
    assert updated_payload["department"] == "Student Affairs"
    assert {role["name"] for role in updated_payload["roles"]} == {"staff"}

    delete_response = client.delete(
        f"/users/{target_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == 204

    users_response = client.get(
        "/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert users_response.status_code == 200
    assert all(user["id"] != target_user_id for user in users_response.json())


def test_normalize_user_roles_keeps_highest_priority_role(client, db_session):
    register_response = client.post(
        "/auth/register",
        json={
            "email": "normalize@example.com",
            "first_name": "Role",
            "last_name": "Normalizer",
            "matric_number": "CSC/24/2222",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == 201

    user_id = uuid.UUID(register_response.json()["id"])
    user = db_session.get(User, user_id)
    assert user is not None

    staff_role = get_role_by_name(db_session, "staff")
    admin_role = get_role_by_name(db_session, "admin")
    assert staff_role is not None
    assert admin_role is not None

    user.roles.extend([staff_role, admin_role])
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    changed = normalize_user_roles(db_session, user)
    assert changed is True
    db_session.commit()
    db_session.refresh(user)

    role_names = {role.name for role in user.roles}
    assert role_names == {"admin"}


def test_normalize_all_user_roles_updates_legacy_multi_role_users(client, db_session):
    register_response = client.post(
        "/auth/register",
        json={
            "email": "legacy@example.com",
            "first_name": "Legacy",
            "last_name": "User",
            "matric_number": "CSC/24/3333",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == 201

    user_id = uuid.UUID(register_response.json()["id"])
    user = db_session.get(User, user_id)
    assert user is not None

    staff_role = get_role_by_name(db_session, "staff")
    assert staff_role is not None

    user.roles.append(staff_role)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    normalized_count = normalize_all_user_roles(db_session)
    assert normalized_count == 1

    db_session.refresh(user)
    role_names = {role.name for role in user.roles}
    assert role_names == {"staff"}


def test_admin_cannot_demote_self_via_users_endpoint(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "self-admin@example.com",
            "first_name": "Self",
            "last_name": "Admin",
            "matric_number": "ADM/24/0100",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = uuid.UUID(admin_register_response.json()["id"])
    assign_role(db_session, admin_user_id, "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "self-admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    assign_response = client.post(
        f"/users/{admin_user_id}/roles",
        json={"role_name": "student"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert assign_response.status_code == 400
    assert "cannot remove their own admin role" in assign_response.json()["detail"].lower()


def test_admin_cannot_delete_self_via_users_endpoint(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "delete-self-admin@example.com",
            "first_name": "Delete",
            "last_name": "Admin",
            "matric_number": "ADM/24/0400",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = admin_register_response.json()["id"]
    assign_role(db_session, uuid.UUID(admin_user_id), "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "delete-self-admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    delete_response = client.delete(
        f"/users/{admin_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == 400
    assert "cannot delete their own account" in delete_response.json()["detail"].lower()


def test_admin_cannot_delete_user_with_submitted_grievances(client, db_session):
    admin_register_response = client.post(
        "/auth/register",
        json={
            "email": "history-admin@example.com",
            "first_name": "History",
            "last_name": "Admin",
            "matric_number": "ADM/24/0500",
            "password": "StrongPass123!",
        },
    )
    admin_user_id = uuid.UUID(admin_register_response.json()["id"])
    assign_role(db_session, admin_user_id, "admin")

    admin_login_response = client.post(
        "/auth/login",
        json={"email": "history-admin@example.com", "password": "StrongPass123!"},
    )
    admin_token = admin_login_response.json()["access_token"]

    student_register_response = client.post(
        "/auth/register",
        json={
            "email": "history-student@example.com",
            "first_name": "History",
            "last_name": "Student",
            "matric_number": "CSC/24/6601",
            "password": "StrongPass123!",
        },
    )
    student_user_id = student_register_response.json()["id"]

    student_login_response = client.post(
        "/auth/login",
        json={"email": "history-student@example.com", "password": "StrongPass123!"},
    )
    student_token = student_login_response.json()["access_token"]

    grievance_response = client.post(
        "/grievances",
        json={
            "title": "Portal access failure",
            "description": "The student portal rejects valid credentials and blocks access to results.",
            "category": "ict",
            "is_anonymous": False,
        },
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert grievance_response.status_code == 201

    delete_response = client.delete(
        f"/users/{student_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_response.status_code == 400
    assert "submitted grievances" in delete_response.json()["detail"].lower()
