from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.services.user_service import ROLE_STUDENT, get_role_by_name, seed_roles


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.email == email.lower())
    )


def get_user_by_matric_number(db: Session, matric_number: str) -> User | None:
    return db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.matric_number == matric_number)
    )


def register_student(
    db: Session,
    email: str,
    password: str,
    first_name: str | None = None,
    last_name: str | None = None,
    matric_number: str | None = None,
) -> User:
    normalized_email = email.lower()
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user:
        raise ValueError("Email is already registered")

    normalized_first_name = first_name.strip() if first_name else None
    normalized_last_name = last_name.strip() if last_name else None
    normalized_matric_number = matric_number.strip() if matric_number else None

    if normalized_matric_number:
        existing_matric_user = get_user_by_matric_number(db, normalized_matric_number)
        if existing_matric_user:
            raise ValueError("Matric number is already registered")

    seed_roles(db)
    student_role = get_role_by_name(db, ROLE_STUDENT)
    if student_role is None:
        raise RuntimeError("Student role is unavailable")

    new_user = User(
        email=normalized_email,
        hashed_password=get_password_hash(password),
        first_name=normalized_first_name,
        last_name=normalized_last_name,
        matric_number=normalized_matric_number,
        is_active=True,
    )
    new_user.roles.append(student_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email.lower())
    if user is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
