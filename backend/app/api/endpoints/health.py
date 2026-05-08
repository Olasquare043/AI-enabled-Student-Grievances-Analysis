from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import require_role
from app.db.session import SessionLocal
from app.models.user import User

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return {"status": "ok"}


@router.get("/health/metrics")
def health_metrics(
    request: Request,
    _: Annotated[User, Depends(require_role("admin"))],
) -> dict[str, object]:
    monitoring_state = getattr(request.app.state, "monitoring_state", None)
    if monitoring_state is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Monitoring state unavailable",
        )
    return monitoring_state.snapshot()
