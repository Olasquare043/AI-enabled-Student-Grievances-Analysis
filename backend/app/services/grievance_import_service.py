from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.grievance import GrievanceCreateRequest
from app.services.auth_service import get_user_by_email
from app.services.grievance_service import create_grievance

MAX_IMPORT_ROWS = 5000
TRUTHY_VALUES = {"1", "true", "yes", "y", "t"}
FALSY_VALUES = {"0", "false", "no", "n", "", "f"}


@dataclass(frozen=True)
class CSVImportError:
    row_number: int
    message: str


@dataclass(frozen=True)
class CSVImportResult:
    total_rows: int
    imported_count: int
    errors: list[CSVImportError]

    @property
    def failed_count(self) -> int:
        return len(self.errors)


class CSVImportInputError(Exception):
    pass


def _parse_bool(value: Any, row_number: int) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    normalized = str(value).strip().lower()
    if normalized in TRUTHY_VALUES:
        return True
    if normalized in FALSY_VALUES:
        return False
    raise CSVImportInputError(
        f"Row {row_number}: invalid is_anonymous value '{value}'."
    )


def import_grievances_from_csv(
    db: Session,
    *,
    csv_bytes: bytes,
    acting_user: User,
) -> CSVImportResult:
    if not csv_bytes:
        raise CSVImportInputError("Uploaded CSV file is empty.")

    try:
        csv_text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CSVImportInputError("CSV must be UTF-8 encoded.") from exc

    reader = csv.DictReader(StringIO(csv_text))
    required_columns = {"title", "description", "category"}
    missing_columns = sorted(required_columns - set(reader.fieldnames or []))
    if missing_columns:
        raise CSVImportInputError(
            "CSV is missing required columns: " + ", ".join(missing_columns)
        )

    imported_count = 0
    errors: list[CSVImportError] = []
    total_rows = 0

    for row_number, row in enumerate(reader, start=2):
        total_rows += 1
        if total_rows > MAX_IMPORT_ROWS:
            errors.append(
                CSVImportError(
                    row_number=row_number,
                    message=(
                        f"Import row limit exceeded ({MAX_IMPORT_ROWS}). "
                        "Split the file into smaller batches."
                    ),
                )
            )
            break

        title = str(row.get("title", "")).strip()
        description = str(row.get("description", "")).strip()
        category = str(row.get("category", "")).strip().lower()
        student_email = str(row.get("student_email", "")).strip().lower()

        try:
            is_anonymous = _parse_bool(row.get("is_anonymous", False), row_number)
        except CSVImportInputError as exc:
            errors.append(CSVImportError(row_number=row_number, message=str(exc)))
            continue

        try:
            payload = GrievanceCreateRequest(
                title=title,
                description=description,
                category=category,
                is_anonymous=is_anonymous,
            )
        except ValidationError as exc:
            first_error = exc.errors()[0]
            message = first_error.get("msg", "Validation failed")
            errors.append(
                CSVImportError(
                    row_number=row_number,
                    message=f"Row {row_number}: {message}",
                )
            )
            continue

        target_user = acting_user
        if student_email:
            matched_user = get_user_by_email(db, student_email)
            if matched_user is None:
                errors.append(
                    CSVImportError(
                        row_number=row_number,
                        message=(
                            f"Row {row_number}: student_email '{student_email}' "
                            "was not found."
                        ),
                    )
                )
                continue
            target_user = matched_user

        try:
            create_grievance(db, target_user, payload)
            imported_count += 1
        except ValueError as exc:
            errors.append(
                CSVImportError(
                    row_number=row_number,
                    message=f"Row {row_number}: {exc}",
                )
            )

    return CSVImportResult(
        total_rows=total_rows,
        imported_count=imported_count,
        errors=errors,
    )
