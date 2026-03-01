from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsOverviewResponse, AnalyticsTopicClustersResponse
from app.services.analytics_service import AnalyticsService
from app.services.grievance_service import is_staff_or_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _require_staff_or_admin(current_user: User) -> None:
    if not is_staff_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff or admins can access analytics",
        )


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def analytics_overview_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period_days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> AnalyticsOverviewResponse:
    _require_staff_or_admin(current_user)
    service = AnalyticsService()
    return service.get_overview(db, period_days=period_days)


@router.get("/topic-clusters", response_model=AnalyticsTopicClustersResponse)
def analytics_topic_clusters_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    period_days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> AnalyticsTopicClustersResponse:
    _require_staff_or_admin(current_user)
    service = AnalyticsService()
    return service.get_topic_clusters(db, period_days=period_days)
