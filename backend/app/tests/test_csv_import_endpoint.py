from app.services.auth_service import get_user_by_email
from app.services.user_service import ROLE_ADMIN, assign_role


def _register_user(client, *, email: str, matric_number: str) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "first_name": "Test",
            "last_name": "User",
            "matric_number": matric_number,
            "password": "StrongPass123!",
        },
    )
    assert response.status_code == 201


def _login(client, *, email: str) -> str:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": "StrongPass123!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_admin_can_import_grievances_csv(client, db_session):
    email = "csv-admin@example.com"
    _register_user(client, email=email, matric_number="CSV/24/9001")

    user = get_user_by_email(db_session, email)
    assert user is not None
    assign_role(db_session, user.id, ROLE_ADMIN)

    access_token = _login(client, email=email)

    csv_content = (
        "title,description,category,is_anonymous\n"
        "Portal timeout issue,Registration portal times out repeatedly during submission,ict,false\n"
        "Hostel leak follow-up,Water leak in room C-12 persists after two maintenance requests,hostel,true\n"
    )
    response = client.post(
        "/operations/imports/grievances/csv",
        files={"file": ("import.csv", csv_content, "text/csv")},
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_rows"] == 2
    assert payload["imported_count"] == 2
    assert payload["failed_count"] == 0
    assert payload["errors"] == []

    grievances_response = client.get(
        "/grievances",
        params={"mine": True},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert grievances_response.status_code == 200
    assert len(grievances_response.json()) == 2


def test_non_admin_cannot_import_grievances_csv(client):
    email = "csv-student@example.com"
    _register_user(client, email=email, matric_number="CSV/24/9002")
    access_token = _login(client, email=email)

    csv_content = (
        "title,description,category\n"
        "Fee issue,Payment is still pending after debit,bursary\n"
    )
    response = client.post(
        "/operations/imports/grievances/csv",
        files={"file": ("import.csv", csv_content, "text/csv")},
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 403
