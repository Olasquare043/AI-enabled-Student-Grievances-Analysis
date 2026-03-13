import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleRead(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class UserRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    matric_number: str | None = None
    phone_number: str | None = None
    faculty: str | None = None
    department: str | None = None
    level: str | None = None
    is_active: bool
    created_at: datetime
    roles: list[RoleRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RoleAssignmentRequest(BaseModel):
    role_name: str = Field(pattern="^(student|staff|admin)$")


class AdminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role_name: str = Field(pattern="^(student|staff|admin)$")
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    matric_number: str | None = Field(default=None, min_length=1, max_length=50)
    phone_number: str | None = Field(default=None, min_length=3, max_length=30)
    faculty: str | None = Field(default=None, min_length=1, max_length=120)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    level: str | None = Field(default=None, min_length=1, max_length=32)


class AdminUserUpdateRequest(BaseModel):
    email: EmailStr
    role_name: str = Field(pattern="^(student|staff|admin)$")
    password: str | None = Field(default=None, min_length=8, max_length=128)
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    matric_number: str | None = Field(default=None, min_length=1, max_length=50)
    phone_number: str | None = Field(default=None, min_length=3, max_length=30)
    faculty: str | None = Field(default=None, min_length=1, max_length=120)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    level: str | None = Field(default=None, min_length=1, max_length=32)
    is_active: bool = True


class UserProfileUpdateRequest(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    matric_number: str | None = Field(default=None, min_length=1, max_length=50)
    phone_number: str | None = Field(default=None, min_length=3, max_length=30)
    faculty: str | None = Field(default=None, min_length=1, max_length=120)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    level: str | None = Field(default=None, min_length=1, max_length=32)
