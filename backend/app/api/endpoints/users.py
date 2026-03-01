import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import RoleAssignmentRequest, UserProfileUpdateRequest, UserRead
from app.services.user_service import assign_role, list_users, update_user_profile

router = APIRouter(prefix="/users", tags=["users"])
AdminUser = Annotated[User, Depends(require_role("admin"))]


@router.patch("/me", response_model=UserRead)
def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        return update_user_profile(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("", response_model=list[UserRead])
def list_users_endpoint(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[User]:
    return list_users(db)


@router.post("/{user_id}/roles", response_model=UserRead)
def assign_role_endpoint(
    user_id: uuid.UUID,
    payload: RoleAssignmentRequest,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        return assign_role(db, user_id, payload.role_name)
    except ValueError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc
