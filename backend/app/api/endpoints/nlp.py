import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.nlp import (
    NLPClusterRequest,
    NLPGrievanceAnalysisRequest,
    NLPGrievanceAnalysisResponse,
    NLPProviderStatus,
    NLPTextAnalysisRequest,
    NLPTextAnalysisResponse,
    NLPTopicClusterResponse,
)
from app.services.grievance_service import (
    ensure_can_access_grievance,
    get_grievance_by_id,
    is_staff_or_admin,
)
from app.services.nlp_service import NLPService

router = APIRouter(prefix="/nlp", tags=["nlp"])


def _require_staff_or_admin(current_user: User) -> None:
    if not is_staff_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff or admins can access NLP operations",
        )


@router.get("/provider", response_model=NLPProviderStatus)
def nlp_provider_status() -> NLPProviderStatus:
    settings = get_settings()
    llm_enabled = settings.llm_provider == "groq" and bool(settings.groq_api_key)
    provider = "groq" if llm_enabled else "none"
    model = settings.groq_model if llm_enabled else None
    return NLPProviderStatus(provider=provider, llm_enabled=llm_enabled, model=model)


@router.post("/analyze", response_model=NLPTextAnalysisResponse)
def analyze_text_endpoint(
    payload: NLPTextAnalysisRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NLPTextAnalysisResponse:
    _require_staff_or_admin(current_user)
    service = NLPService()
    return service.analyze_text(
        db,
        payload.text,
        include_llm_enrichment=payload.include_llm_enrichment,
    )


@router.post("/grievances/{grievance_id}/analyze", response_model=NLPGrievanceAnalysisResponse)
def analyze_grievance_endpoint(
    grievance_id: uuid.UUID,
    payload: NLPGrievanceAnalysisRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NLPGrievanceAnalysisResponse:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        ensure_can_access_grievance(current_user, grievance)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    service = NLPService()
    return service.analyze_grievance(
        db,
        grievance,
        include_llm_enrichment=payload.include_llm_enrichment,
    )


@router.post("/cluster", response_model=list[NLPTopicClusterResponse])
def cluster_grievances_endpoint(
    payload: NLPClusterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[NLPTopicClusterResponse]:
    _require_staff_or_admin(current_user)
    service = NLPService()
    try:
        return service.cluster_grievances(
            db,
            status=payload.status,
            category=payload.category,
            department_id=payload.department_id,
            limit=payload.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
