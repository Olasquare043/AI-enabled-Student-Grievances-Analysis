import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.grievance import GRIEVANCE_STATUS_VALUES

GrievanceStatus = Literal["open", "in_progress", "resolved", "closed"]


class GrievanceUserSummary(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str | None = None
    last_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class GrievanceDepartmentSummary(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


class GrievanceCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=6000)
    category: str = Field(min_length=2, max_length=64)
    is_anonymous: bool = False


class GrievanceListItem(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    title: str
    category: str
    status: GrievanceStatus
    is_anonymous: bool
    assigned_to_user_id: uuid.UUID | None = None
    department_id: int | None = None
    created_at: datetime
    updated_at: datetime
    first_response_at: datetime | None = None
    resolved_at: datetime | None = None
    student: GrievanceUserSummary
    assigned_to_user: GrievanceUserSummary | None = None
    department: GrievanceDepartmentSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class GrievanceCommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class GrievanceCommentRead(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    user_id: uuid.UUID | None = None
    body: str
    created_at: datetime
    user: GrievanceUserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class GrievanceStatusHistoryRead(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    changed_by_user_id: uuid.UUID | None = None
    from_status: str | None = None
    to_status: GrievanceStatus
    note: str | None = None
    created_at: datetime
    changed_by_user: GrievanceUserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class GrievanceRead(GrievanceListItem):
    description: str
    resolution_note: str | None = None
    comments: list[GrievanceCommentRead] = Field(default_factory=list)
    status_history: list[GrievanceStatusHistoryRead] = Field(default_factory=list)


class GrievanceStatusUpdateRequest(BaseModel):
    status: GrievanceStatus
    resolution_note: str | None = Field(default=None, max_length=6000)


class GrievanceAssignRequest(BaseModel):
    assignee_user_id: uuid.UUID


def ensure_grievance_status(value: str) -> str:
    if value not in GRIEVANCE_STATUS_VALUES:
        valid = ", ".join(GRIEVANCE_STATUS_VALUES)
        raise ValueError(f"Invalid status '{value}'. Expected one of: {valid}")
    return value
