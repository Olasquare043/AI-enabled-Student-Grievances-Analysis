import getpass
import sys
from typing import NoReturn

from email_validator import EmailNotValidError, validate_email
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.services.auth_service import get_user_by_email, register_student
from app.services.user_service import ROLE_ADMIN, assign_role, seed_roles


def abort(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    email_input = input("Admin email: ").strip().lower()
    if not email_input:
        abort("Email is required.")
    try:
        email = validate_email(email_input, check_deliverability=False).email
    except EmailNotValidError as exc:
        abort(f"Invalid email address: {exc}")

    password = getpass.getpass("Admin password: ")
    confirm_password = getpass.getpass("Confirm password: ")
    if password != confirm_password:
        abort("Passwords do not match.")
    if len(password) < 8:
        abort("Password must be at least 8 characters.")

    with SessionLocal() as db:
        try:
            seed_roles(db)
            user = get_user_by_email(db, email)
            created = False
            if user is None:
                user = register_student(db, email, password)
                created = True

            updated_user = assign_role(db, user.id, ROLE_ADMIN)
            action = "created" if created else "updated"
            print(
                f"Admin bootstrap completed ({action}). "
                f"User: {updated_user.email}"
            )
        except (ValueError, RuntimeError, SQLAlchemyError) as exc:
            abort(f"Failed to bootstrap admin: {exc}")


if __name__ == "__main__":
    main()
