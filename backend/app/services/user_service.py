import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserProfileUpdateRequest

ROLE_STUDENT = "student"
ROLE_STAFF = "staff"
ROLE_ADMIN = "admin"
DEFAULT_ROLES = (ROLE_STUDENT, ROLE_STAFF, ROLE_ADMIN)


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


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.scalar(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )


def list_users(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .options(selectinload(User.roles))
            .order_by(User.created_at.desc())
        )
    )


def assign_role(db: Session, user_id: uuid.UUID, role_name: str) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")

    role = get_role_by_name(db, role_name)
    if role is None:
        raise ValueError("Role not found")

    existing_roles = {assigned_role.name for assigned_role in user.roles}
    if role.name not in existing_roles:
        user.roles.append(role)
        db.commit()
        db.refresh(user)

    return user


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
