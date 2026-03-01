import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.grievance import (
    GrievanceAssignRequest,
    GrievanceCommentCreateRequest,
    GrievanceCommentRead,
    GrievanceCreateRequest,
    GrievanceListItem,
    GrievanceRead,
    GrievanceStatusUpdateRequest,
)
from app.services.grievance_comment_service import (
    add_grievance_comment,
    list_grievance_comments,
)
from app.services.grievance_service import (
    assign_grievance,
    create_grievance,
    ensure_can_access_grievance,
    get_grievance_by_id,
    list_grievances,
    list_triage_queue,
    update_grievance_status,
)

router = APIRouter(prefix="/grievances", tags=["grievances"])


@router.post("", response_model=GrievanceRead, status_code=status.HTTP_201_CREATED)
def create_grievance_endpoint(
    payload: GrievanceCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceRead:
    try:
        grievance = create_grievance(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GrievanceRead.model_validate(grievance)


@router.get("", response_model=list[GrievanceListItem])
def list_grievances_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[str | None, Query(alias="status", min_length=2)] = None,
    category_filter: Annotated[str | None, Query(alias="category", min_length=2)] = None,
    mine: bool = False,
) -> list[GrievanceListItem]:
    try:
        grievances = list_grievances(
            db,
            current_user,
            status=status_filter,
            category=category_filter,
            mine=mine,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [GrievanceListItem.model_validate(item) for item in grievances]


@router.get("/queue", response_model=list[GrievanceListItem])
def triage_queue_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[str | None, Query(alias="status", min_length=2)] = None,
    category_filter: Annotated[str | None, Query(alias="category", min_length=2)] = None,
) -> list[GrievanceListItem]:
    try:
        grievances = list_triage_queue(
            db,
            current_user,
            status=status_filter,
            category=category_filter,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [GrievanceListItem.model_validate(item) for item in grievances]


@router.get("/{grievance_id}", response_model=GrievanceRead)
def get_grievance_endpoint(
    grievance_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceRead:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        ensure_can_access_grievance(current_user, grievance)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return GrievanceRead.model_validate(grievance)


@router.post(
    "/{grievance_id}/comments",
    response_model=GrievanceCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def add_grievance_comment_endpoint(
    grievance_id: uuid.UUID,
    payload: GrievanceCommentCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceCommentRead:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        ensure_can_access_grievance(current_user, grievance)
        comment = add_grievance_comment(db, grievance, current_user, payload.body)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return GrievanceCommentRead.model_validate(comment)


@router.get("/{grievance_id}/comments", response_model=list[GrievanceCommentRead])
def list_grievance_comments_endpoint(
    grievance_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[GrievanceCommentRead]:
    grievance = get_grievance_by_id(db, grievance_id, include_details=False)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        ensure_can_access_grievance(current_user, grievance)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    comments = list_grievance_comments(db, grievance_id)
    return [GrievanceCommentRead.model_validate(item) for item in comments]


@router.patch("/{grievance_id}/status", response_model=GrievanceRead)
def update_grievance_status_endpoint(
    grievance_id: uuid.UUID,
    payload: GrievanceStatusUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceRead:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        updated = update_grievance_status(db, grievance, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return GrievanceRead.model_validate(updated)


@router.post("/{grievance_id}/assign", response_model=GrievanceRead)
def assign_grievance_endpoint(
    grievance_id: uuid.UUID,
    payload: GrievanceAssignRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceRead:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        updated = assign_grievance(db, grievance, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc

    return GrievanceRead.model_validate(updated)
