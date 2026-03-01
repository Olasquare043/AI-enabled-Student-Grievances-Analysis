import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.grievance import Grievance
from app.models.grievance_comment import GrievanceComment
from app.models.user import User
from app.services.grievance_service import is_staff_or_admin
from app.services.sla_service import mark_first_response_if_needed


def _normalize_comment_body(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Comment body cannot be empty")
    return cleaned


def add_grievance_comment(
    db: Session,
    grievance: Grievance,
    author: User,
    body: str,
) -> GrievanceComment:
    normalized_body = _normalize_comment_body(body)

    comment = GrievanceComment(
        grievance_id=grievance.id,
        user_id=author.id,
        body=normalized_body,
    )
    db.add(comment)
    db.flush()

    db.add(
        AuditLog(
            user_id=author.id,
            action="grievance.comment_added",
            details={
                "grievance_id": str(grievance.id),
                "comment_id": str(comment.id),
                "commented_by_user_id": str(author.id),
            },
        )
    )

    if is_staff_or_admin(author):
        mark_first_response_if_needed(
            db,
            grievance,
            actor_user_id=author.id,
            source="comment",
        )

    db.commit()
    stored = db.scalar(
        select(GrievanceComment)
        .options(selectinload(GrievanceComment.user))
        .where(GrievanceComment.id == comment.id)
    )
    if stored is None:
        raise RuntimeError("Created comment could not be reloaded")
    return stored


def list_grievance_comments(db: Session, grievance_id: uuid.UUID) -> list[GrievanceComment]:
    stmt = (
        select(GrievanceComment)
        .options(selectinload(GrievanceComment.user))
        .where(GrievanceComment.grievance_id == grievance_id)
        .order_by(GrievanceComment.created_at.asc())
    )
    return list(db.scalars(stmt))
