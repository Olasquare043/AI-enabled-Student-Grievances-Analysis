import uuid
from datetime import datetime

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
