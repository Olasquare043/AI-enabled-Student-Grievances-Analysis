import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.grievance import GrievanceDepartmentSummary

BreachType = Literal["first_response", "resolution"]
EscalationSeverity = Literal["warning", "critical"]
EscalationTargetRole = Literal["staff", "admin"]


class SLAPolicyUpsertRequest(BaseModel):
    first_response_minutes: int = Field(ge=1, le=43200)
    resolution_minutes: int = Field(ge=1, le=525600)
    is_active: bool = True


class SLAPolicyRead(BaseModel):
    id: int
    department_id: int
    first_response_minutes: int
    resolution_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    department: GrievanceDepartmentSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class EscalationRuleCreateRequest(BaseModel):
    department_id: int | None = Field(default=None, gt=0)
    breach_type: BreachType
    severity: EscalationSeverity
    threshold_minutes: int = Field(ge=0, le=43200)
    target_role: EscalationTargetRole
    is_active: bool = True


class EscalationRuleRead(BaseModel):
    id: int
    department_id: int | None = None
    breach_type: str
    severity: str
    threshold_minutes: int
    target_role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    department: GrievanceDepartmentSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class SLAEventRead(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    department_id: int | None = None
    policy_id: int | None = None
    escalation_rule_id: int | None = None
    parent_event_id: uuid.UUID | None = None
    event_type: str
    status: str
    due_at: datetime | None = None
    occurred_at: datetime | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SLAEvaluationResponse(BaseModel):
    evaluated_at: datetime
    new_breaches: int
    new_escalations: int


class SLABreachSummary(BaseModel):
    event_id: uuid.UUID
    grievance_id: uuid.UUID
    department_id: int | None = None
    breach_type: str
    due_at: datetime
    occurred_at: datetime | None = None
    breach_minutes: int
    escalation_count: int
