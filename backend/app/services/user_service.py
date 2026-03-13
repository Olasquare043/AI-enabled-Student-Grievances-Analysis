import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_password_hash
from app.models.grievance import Grievance
from app.models.role import Role
from app.models.user import User
from app.schemas.user import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    UserProfileUpdateRequest,
)

ROLE_STUDENT = "student"
ROLE_STAFF = "staff"
ROLE_ADMIN = "admin"
DEFAULT_ROLES = (ROLE_STUDENT, ROLE_STAFF, ROLE_ADMIN)
ROLE_PRIORITY = {
    ROLE_STUDENT: 0,
    ROLE_STAFF: 1,
    ROLE_ADMIN: 2,
}


def seed_roles(db: Session) -> None:
    existing_roles = {
        role_name
        for role_name in db.execute(select(Role.name)).scalars().all()
    }
    created = False
    for role_name in DEFAULT_ROLES:
        if role_name not in existing_roles:
            db.add(Role(name=role_name))
            created = True
    if created:
        db.commit()


def get_role_by_name(db: Session, role_name: str) -> Role | None:
    return db.scalar(select(Role).where(Role.name == role_name))


def get_primary_role(user: User) -> Role | None:
    if not user.roles:
        return None
    return max(user.roles, key=lambda role: ROLE_PRIORITY.get(role.name, -1))


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )


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


def list_users(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .options(selectinload(User.roles))
            .order_by(User.created_at.desc())
        )
    )


def create_user(db: Session, payload: AdminUserCreateRequest) -> User:
    normalized_email = payload.email.lower()
    if get_user_by_email(db, normalized_email) is not None:
        raise ValueError("Email is already registered")

    normalized_matric_number = payload.matric_number.strip() if payload.matric_number else None
    if normalized_matric_number and get_user_by_matric_number(db, normalized_matric_number) is not None:
        raise ValueError("Matric number is already registered")

    seed_roles(db)
    role = get_role_by_name(db, payload.role_name)
    if role is None:
        raise ValueError("Role not found")

    new_user = User(
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name.strip() if payload.first_name else None,
        last_name=payload.last_name.strip() if payload.last_name else None,
        matric_number=normalized_matric_number,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        faculty=payload.faculty.strip() if payload.faculty else None,
        department=payload.department.strip() if payload.department else None,
        level=payload.level.strip() if payload.level else None,
        is_active=True,
    )
    new_user.roles = [role]
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def update_user(db: Session, user_id: uuid.UUID, payload: AdminUserUpdateRequest) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")

    normalized_email = payload.email.lower()
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user is not None and existing_user.id != user.id:
        raise ValueError("Email is already registered")

    normalized_matric_number = payload.matric_number.strip() if payload.matric_number else None
    existing_matric_user = (
        get_user_by_matric_number(db, normalized_matric_number)
        if normalized_matric_number
        else None
    )
    if existing_matric_user is not None and existing_matric_user.id != user.id:
        raise ValueError("Matric number is already registered")

    role = get_role_by_name(db, payload.role_name)
    if role is None:
        raise ValueError("Role not found")

    user.email = normalized_email
    user.first_name = payload.first_name.strip() if payload.first_name else None
    user.last_name = payload.last_name.strip() if payload.last_name else None
    user.matric_number = normalized_matric_number
    user.phone_number = payload.phone_number.strip() if payload.phone_number else None
    user.faculty = payload.faculty.strip() if payload.faculty else None
    user.department = payload.department.strip() if payload.department else None
    user.level = payload.level.strip() if payload.level else None
    user.is_active = payload.is_active
    user.roles = [role]

    if payload.password:
        user.hashed_password = get_password_hash(payload.password)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: uuid.UUID) -> None:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")

    submitted_grievance_count = db.scalar(
        select(func.count())
        .select_from(Grievance)
        .where(Grievance.student_id == user.id)
    )
    if submitted_grievance_count:
        raise ValueError(
            "Cannot delete a user with submitted grievances. Deactivate the account or remove the grievance records first."
        )

    db.delete(user)
    db.commit()


def assign_role(db: Session, user_id: uuid.UUID, role_name: str) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")

    role = get_role_by_name(db, role_name)
    if role is None:
        raise ValueError("Role not found")

    existing_role_ids = {assigned_role.id for assigned_role in user.roles}
    if existing_role_ids != {role.id}:
        user.roles = [role]
        db.commit()
        db.refresh(user)

    return user


def normalize_user_roles(db: Session, user: User) -> bool:
    primary_role = get_primary_role(user)
    if primary_role is None:
        return False

    current_role_ids = {role.id for role in user.roles}
    desired_role_ids = {primary_role.id}
    if current_role_ids == desired_role_ids:
        return False

    user.roles = [primary_role]
    db.add(user)
    return True


def normalize_all_user_roles(db: Session) -> int:
    users = list_users(db)
    normalized_count = 0

    for user in users:
        if normalize_user_roles(db, user):
            normalized_count += 1

    if normalized_count > 0:
        db.commit()

    return normalized_count


def update_user_profile(
    db: Session,
    user: User,
    payload: UserProfileUpdateRequest,
) -> User:
    incoming = payload.model_dump(exclude_unset=True)
    if not incoming:
        return user

    normalized: dict[str, str | None] = {}
    for key, value in incoming.items():
        if isinstance(value, str):
            cleaned = value.strip()
            normalized[key] = cleaned if cleaned else None
        else:
            normalized[key] = value

    matric_number = normalized.get("matric_number")
    if matric_number:
        existing = db.scalar(
            select(User).where(
                User.matric_number == matric_number,
                User.id != user.id,
            )
        )
        if existing is not None:
            raise ValueError("Matric number is already assigned to another user")

    for key, value in normalized.items():
        setattr(user, key, value)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
