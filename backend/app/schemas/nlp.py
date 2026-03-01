import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NLPCategoryScore(BaseModel):
    label: str
    score: float


class NLPSentimentResult(BaseModel):
    label: str
    score: float
    positive_hits: int
    negative_hits: int


class NLPUrgencyResult(BaseModel):
    label: str
    score: float
    reasons: list[str]


class NLPTextAnalysisRequest(BaseModel):
    text: str = Field(min_length=10, max_length=12000)
    include_llm_enrichment: bool = True


class NLPGrievanceAnalysisRequest(BaseModel):
    include_llm_enrichment: bool = True


class NLPTextAnalysisResponse(BaseModel):
    provider: str
    predicted_category: str
    category_confidence: float
    category_suggestions: list[NLPCategoryScore]
    sentiment: NLPSentimentResult
    urgency: NLPUrgencyResult
    summary: str
    entities: dict[str, Any]


class NLPGrievanceAnalysisResponse(NLPTextAnalysisResponse):
    grievance_id: uuid.UUID
    source_category: str


class NLPClusterRequest(BaseModel):
    status: str | None = Field(default=None, min_length=2, max_length=32)
    category: str | None = Field(default=None, min_length=2, max_length=64)
    department_id: int | None = Field(default=None, gt=0)
    limit: int = Field(default=200, ge=5, le=500)


class NLPClusterMember(BaseModel):
    grievance_id: uuid.UUID
    title: str
    category: str
    status: str
    created_at: datetime


class NLPTopicClusterResponse(BaseModel):
    cluster_id: int
    size: int
    top_keywords: list[str]
    members: list[NLPClusterMember]


class NLPProviderStatus(BaseModel):
    provider: str
    llm_enabled: bool
    model: str | None = None
