import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class VolumeTrendPoint(BaseModel):
    date: str
    total: int


class CategoryDistributionPoint(BaseModel):
    category: str
    count: int
    share_percent: float


class DepartmentHotspotPoint(BaseModel):
    department_id: int | None = None
    department_name: str
    grievance_count: int
    breach_count: int
    avg_resolution_hours: float | None = None


class FacultyHotspotPoint(BaseModel):
    faculty: str
    grievance_count: int


class BacklogMetrics(BaseModel):
    open_count: int
    in_progress_count: int
    resolved_count: int
    closed_count: int
    total_backlog: int
    overdue_backlog: int


class ResolutionMetrics(BaseModel):
    resolved_count: int
    avg_resolution_hours: float | None = None
    median_resolution_hours: float | None = None
    p90_resolution_hours: float | None = None


class SLACompliancePoint(BaseModel):
    breach_type: str
    met_count: int
    breached_count: int
    compliance_rate_percent: float


class TopicClusterInsight(BaseModel):
    cluster_id: int
    size: int
    top_keywords: list[str]
    member_ids: list[uuid.UUID] = Field(default_factory=list)
    sample_titles: list[str] = Field(default_factory=list)


class AnalyticsOverviewResponse(BaseModel):
    generated_at: datetime
    period_days: int
    total_grievances: int
    volume_trend: list[VolumeTrendPoint]
    category_distribution: list[CategoryDistributionPoint]
    department_hotspots: list[DepartmentHotspotPoint]
    faculty_hotspots: list[FacultyHotspotPoint]
    backlog: BacklogMetrics
    resolution: ResolutionMetrics
    sla_compliance: list[SLACompliancePoint]
    escalation_events: int
    active_breaches: int


class AnalyticsTopicClustersResponse(BaseModel):
    generated_at: datetime
    period_days: int
    clusters: list[TopicClusterInsight]


class TopicTrendSeries(BaseModel):
    topic_id: int
    label: str
    top_words: list[str]
    count: int
    share_percent: float
    weekly_counts: list[int]
    alert_weeks: list[str] = Field(default_factory=list)


class TopicSpikeAlert(BaseModel):
    topic_id: int
    label: str
    week_start: str
    count: int
    threshold: float


class AnalyticsTopicTrendsResponse(BaseModel):
    generated_at: datetime
    period_days: int
    weeks: list[str]
    topics: list[TopicTrendSeries]
    alerts: list[TopicSpikeAlert]
    method: str


class ModelCardEntry(BaseModel):
    name: str
    cv_macro_f1: float
    accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float


class LiveTriageStats(BaseModel):
    triaged_grievances: int
    auto_routed: int
    auto_route_rate_percent: float
    category_overrides: int
    override_rate_percent: float
    agreement_with_student_percent: float | None = None


class AnalyticsModelCardResponse(BaseModel):
    available: bool
    model: str
    auto_route_threshold: float | None = None
    trained_on: dict[str, Any] = Field(default_factory=dict)
    models: list[ModelCardEntry] = Field(default_factory=list)
    student_self_selection_accuracy: float | None = None
    per_class: list[dict[str, Any]] = Field(default_factory=list)
    urgency: dict[str, Any] = Field(default_factory=dict)
    explainability: dict[str, Any] = Field(default_factory=dict)
    topics: dict[str, Any] = Field(default_factory=dict)
    live: LiveTriageStats
