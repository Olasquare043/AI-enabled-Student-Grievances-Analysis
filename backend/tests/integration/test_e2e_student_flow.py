from fastapi import status

from .helpers import auth_headers, register_and_login


def test_e2e_student_portal_flow(client):
    student_a = register_and_login(
        client,
        email="e2e.student.a@example.com",
        first_name="Student",
        last_name="Alpha",
        matric_number="STD/26/9001",
    )
    student_b = register_and_login(
        client,
        email="e2e.student.b@example.com",
        first_name="Student",
        last_name="Beta",
        matric_number="STD/26/9002",
    )

    me_response = client.get("/auth/me", headers=auth_headers(student_a["token"]))
    assert me_response.status_code == status.HTTP_200_OK
    assert me_response.json()["email"] == "e2e.student.a@example.com"
    assert {role["name"] for role in me_response.json()["roles"]} == {"student"}

    create_response = client.post(
        "/grievances",
        json={
            "title": "Portal access denied",
            "description": "The academic portal denies access after successful login for two days.",
            "category": "ict",
            "is_anonymous": False,
        },
        headers=auth_headers(student_a["token"]),
    )
    assert create_response.status_code == status.HTTP_201_CREATED
    grievance_id = create_response.json()["id"]

    comment_response = client.post(
        f"/grievances/{grievance_id}/comments",
        json={"body": "Please review urgently because registration closes tomorrow."},
        headers=auth_headers(student_a["token"]),
    )
    assert comment_response.status_code == status.HTTP_201_CREATED

    my_list_response = client.get("/grievances?mine=true", headers=auth_headers(student_a["token"]))
    assert my_list_response.status_code == status.HTTP_200_OK
    my_ids = {item["id"] for item in my_list_response.json()}
    assert grievance_id in my_ids

    detail_response = client.get(
        f"/grievances/{grievance_id}",
        headers=auth_headers(student_a["token"]),
    )
    assert detail_response.status_code == status.HTTP_200_OK
    detail_payload = detail_response.json()
    assert detail_payload["id"] == grievance_id
    assert len(detail_payload["comments"]) == 1

    other_create_response = client.post(
        "/grievances",
        json={
            "title": "Result not published",
            "description": "My result is missing for the semester and grading has not updated.",
            "category": "academic",
            "is_anonymous": True,
        },
        headers=auth_headers(student_b["token"]),
    )
    assert other_create_response.status_code == status.HTTP_201_CREATED
    other_grievance_id = other_create_response.json()["id"]

    forbidden_detail = client.get(
        f"/grievances/{other_grievance_id}",
        headers=auth_headers(student_a["token"]),
    )
    assert forbidden_detail.status_code == status.HTTP_403_FORBIDDEN
