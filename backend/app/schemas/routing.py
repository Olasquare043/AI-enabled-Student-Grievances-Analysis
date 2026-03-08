import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.grievance import GrievanceDepartmentSummary, GrievanceUserSummary


class DepartmentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=32)


class DepartmentRead(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    code: str | None = Field(default=None, min_length=2, max_length=32)
    is_active: bool | None = None


class RouteGrievanceRequest(BaseModel):
    department_id: int = Field(gt=0)
    assignee_user_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=2000)


class GrievanceAssignmentRead(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    department_id: int | None = None
    assigned_to_user_id: uuid.UUID | None = None
    assigned_by_user_id: uuid.UUID | None = None
    note: str | None = None
    created_at: datetime
    department: GrievanceDepartmentSummary | None = None
    assigned_to_user: GrievanceUserSummary | None = None
    assigned_by_user: GrievanceUserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class OperationalGrievanceItem(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    status: str
    created_at: datetime
    department: GrievanceDepartmentSummary | None = None
    student: GrievanceUserSummary
    assigned_to_user: GrievanceUserSummary | None = None
    first_response_due_at: datetime | None = None
    first_response_status: str | None = None
    resolution_due_at: datetime | None = None
    resolution_status: str | None = None
    escalation_count: int = 0
    has_active_breach: bool = False


class GrievanceCSVImportError(BaseModel):
    row_number: int
    message: str


class GrievanceCSVImportResponse(BaseModel):
    total_rows: int
    imported_count: int
    failed_count: int
    errors: list[GrievanceCSVImportError] = Field(default_factory=list)
