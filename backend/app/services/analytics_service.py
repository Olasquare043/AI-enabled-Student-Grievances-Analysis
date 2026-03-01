from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from statistics import median

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.grievance import (
    GRIEVANCE_STATUS_CLOSED,
    GRIEVANCE_STATUS_IN_PROGRESS,
    GRIEVANCE_STATUS_OPEN,
    GRIEVANCE_STATUS_RESOLVED,
    Grievance,
)
from app.models.sla_event import SLAEvent
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsTopicClustersResponse,
    BacklogMetrics,
    CategoryDistributionPoint,
    DepartmentHotspotPoint,
    FacultyHotspotPoint,
    ResolutionMetrics,
    SLACompliancePoint,
    TopicClusterInsight,
    VolumeTrendPoint,
)
from app.services.nlp_service import NLPService
from app.services.sla_service import (
    SLA_EVENT_ESCALATION,
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
    SLA_STATUS_BREACHED,
    SLA_STATUS_MET,
    SLA_STATUS_PENDING,
    SLA_STATUS_TRIGGERED,
)

MAX_ANALYTICS_PERIOD_DAYS = 365


def _sanitize_period_days(period_days: int) -> int:
    if period_days < 1:
        return 1
    if period_days > MAX_ANALYTICS_PERIOD_DAYS:
        return MAX_ANALYTICS_PERIOD_DAYS
    return period_days


def _period_start(now: datetime, period_days: int) -> datetime:
    days = _sanitize_period_days(period_days)
    start_day = (now - timedelta(days=days - 1)).date()
    return datetime.combine(start_day, time.min, tzinfo=UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _round_or_none(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _duration_hours(start_at: datetime | None, end_at: datetime | None) -> float | None:
    if start_at is None or end_at is None:
        return None
    delta = _as_utc(end_at) - _as_utc(start_at)
    return max(0.0, delta.total_seconds() / 3600.0)


def _percentile(sorted_values: list[float], percentile_value: float) -> float | None:
    if not sorted_values:
        return None
    index = max(0, math.ceil(percentile_value * len(sorted_values)) - 1)
    return sorted_values[index]


class AnalyticsService:
    def __init__(self) -> None:
        self._nlp_service = NLPService()

    def _volume_trend(
        self,
        db: Session,
        *,
        start_at: datetime,
        end_date: date,
    ) -> list[VolumeTrendPoint]:
        rows = db.execute(
            select(
                func.date(Grievance.created_at).label("day"),
                func.count(Grievance.id).label("count"),
            )
            .where(Grievance.created_at >= start_at)
            .group_by(func.date(Grievance.created_at))
            .order_by(func.date(Grievance.created_at).asc())
        ).all()
        counts_by_day = {row.day: int(row.count) for row in rows}

        points: list[VolumeTrendPoint] = []
        current = start_at.date()
        while current <= end_date:
            points.append(
                VolumeTrendPoint(
                    date=current.isoformat(),
                    total=counts_by_day.get(current, 0),
                )
            )
            current += timedelta(days=1)

        return points

    def _category_distribution(
        self,
        db: Session,
        *,
        start_at: datetime,
    ) -> list[CategoryDistributionPoint]:
        rows = db.execute(
            select(
                Grievance.category,
                func.count(Grievance.id).label("count"),
            )
            .where(Grievance.created_at >= start_at)
            .group_by(Grievance.category)
            .order_by(func.count(Grievance.id).desc(), Grievance.category.asc())
        ).all()

        total = sum(int(row.count) for row in rows)
        if total == 0:
            return []

        return [
            CategoryDistributionPoint(
                category=row.category,
                count=int(row.count),
                share_percent=round((int(row.count) / total) * 100.0, 2),
            )
            for row in rows
        ]

    def _department_hotspots(
        self,
        db: Session,
        *,
        start_at: datetime,
    ) -> list[DepartmentHotspotPoint]:
        grievance_rows = db.execute(
            select(
                Grievance.department_id,
                Department.name,
                func.count(Grievance.id).label("grievance_count"),
                func.avg(
                    func.extract("epoch", Grievance.resolved_at - Grievance.created_at)
                    / 3600.0
                ).label("avg_resolution_hours"),
            )
            .join(Department, Department.id == Grievance.department_id, isouter=True)
            .where(Grievance.created_at >= start_at)
            .group_by(Grievance.department_id, Department.name)
            .order_by(func.count(Grievance.id).desc())
        ).all()

        breach_rows = db.execute(
            select(
                SLAEvent.department_id,
                func.count(SLAEvent.id).label("breach_count"),
            )
            .where(
                SLAEvent.created_at >= start_at,
                SLAEvent.status == SLA_STATUS_BREACHED,
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
            .group_by(SLAEvent.department_id)
        ).all()
        breach_by_department = {
            row.department_id: int(row.breach_count) for row in breach_rows
        }

        points: list[DepartmentHotspotPoint] = []
        for row in grievance_rows:
            department_id = row.department_id
            department_name = row.name or "Unassigned"
            points.append(
                DepartmentHotspotPoint(
                    department_id=department_id,
                    department_name=department_name,
                    grievance_count=int(row.grievance_count),
                    breach_count=breach_by_department.get(department_id, 0),
                    avg_resolution_hours=_round_or_none(row.avg_resolution_hours),
                )
            )

        return points

    def _faculty_hotspots(
        self,
        db: Session,
        *,
        start_at: datetime,
    ) -> list[FacultyHotspotPoint]:
        faculty_name = func.coalesce(func.nullif(func.trim(User.faculty), ""), "Unspecified")
        rows = db.execute(
            select(
                faculty_name.label("faculty"),
                func.count(Grievance.id).label("grievance_count"),
            )
            .join(User, User.id == Grievance.student_id)
            .where(Grievance.created_at >= start_at)
            .group_by(faculty_name)
            .order_by(func.count(Grievance.id).desc(), faculty_name.asc())
            .limit(10)
        ).all()

        return [
            FacultyHotspotPoint(
                faculty=str(row.faculty),
                grievance_count=int(row.grievance_count),
            )
            for row in rows
        ]

    def _backlog_metrics(self, db: Session, *, now: datetime) -> BacklogMetrics:
        status_rows = db.execute(
            select(
                Grievance.status,
                func.count(Grievance.id).label("count"),
            )
            .group_by(Grievance.status)
        ).all()
        counts = defaultdict(int, {row.status: int(row.count) for row in status_rows})

        overdue_backlog = db.scalar(
            select(func.count(func.distinct(Grievance.id)))
            .join(SLAEvent, SLAEvent.grievance_id == Grievance.id)
            .where(
                Grievance.status.in_([GRIEVANCE_STATUS_OPEN, GRIEVANCE_STATUS_IN_PROGRESS]),
                SLAEvent.event_type == SLA_EVENT_RESOLUTION_DEADLINE,
                or_(
                    SLAEvent.status == SLA_STATUS_BREACHED,
                    and_(
                        SLAEvent.status == SLA_STATUS_PENDING,
                        SLAEvent.due_at.is_not(None),
                        SLAEvent.due_at < now,
                    ),
                ),
            )
        ) or 0

        open_count = counts[GRIEVANCE_STATUS_OPEN]
        in_progress_count = counts[GRIEVANCE_STATUS_IN_PROGRESS]
        resolved_count = counts[GRIEVANCE_STATUS_RESOLVED]
        closed_count = counts[GRIEVANCE_STATUS_CLOSED]

        return BacklogMetrics(
            open_count=open_count,
            in_progress_count=in_progress_count,
            resolved_count=resolved_count,
            closed_count=closed_count,
            total_backlog=open_count + in_progress_count,
            overdue_backlog=int(overdue_backlog),
        )

    def _resolution_metrics(
        self,
        db: Session,
        *,
        start_at: datetime,
    ) -> ResolutionMetrics:
        rows = db.execute(
            select(Grievance.created_at, Grievance.resolved_at)
            .where(
                Grievance.resolved_at.is_not(None),
                Grievance.resolved_at >= start_at,
            )
        ).all()

        durations = sorted(
            [
                duration
                for duration in (
                    _duration_hours(row.created_at, row.resolved_at) for row in rows
                )
                if duration is not None
            ]
        )

        if not durations:
            return ResolutionMetrics(
                resolved_count=0,
                avg_resolution_hours=None,
                median_resolution_hours=None,
                p90_resolution_hours=None,
            )

        avg = sum(durations) / len(durations)
        med = float(median(durations))
        p90 = _percentile(durations, 0.9)

        return ResolutionMetrics(
            resolved_count=len(durations),
            avg_resolution_hours=_round_or_none(avg),
            median_resolution_hours=_round_or_none(med),
            p90_resolution_hours=_round_or_none(p90),
        )

    def _sla_compliance(
        self,
        db: Session,
        *,
        start_at: datetime,
    ) -> list[SLACompliancePoint]:
        rows = db.execute(
            select(
                SLAEvent.event_type,
                SLAEvent.status,
                func.count(SLAEvent.id).label("count"),
            )
            .where(
                SLAEvent.created_at >= start_at,
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
                SLAEvent.status.in_([SLA_STATUS_MET, SLA_STATUS_BREACHED]),
            )
            .group_by(SLAEvent.event_type, SLAEvent.status)
        ).all()

        counts: dict[str, dict[str, int]] = {
            "first_response": {"met": 0, "breached": 0},
            "resolution": {"met": 0, "breached": 0},
        }
        event_type_to_breach_type = {
            SLA_EVENT_FIRST_RESPONSE_DEADLINE: "first_response",
            SLA_EVENT_RESOLUTION_DEADLINE: "resolution",
        }

        for row in rows:
            breach_type = event_type_to_breach_type[row.event_type]
            if row.status == SLA_STATUS_MET:
                counts[breach_type]["met"] = int(row.count)
            elif row.status == SLA_STATUS_BREACHED:
                counts[breach_type]["breached"] = int(row.count)

        points: list[SLACompliancePoint] = []
        for breach_type in ("first_response", "resolution"):
            met_count = counts[breach_type]["met"]
            breached_count = counts[breach_type]["breached"]
            total = met_count + breached_count
            compliance = round((met_count / total) * 100.0, 2) if total > 0 else 0.0
            points.append(
                SLACompliancePoint(
                    breach_type=breach_type,
                    met_count=met_count,
                    breached_count=breached_count,
                    compliance_rate_percent=compliance,
                )
            )

        return points

    def get_overview(self, db: Session, *, period_days: int = 30) -> AnalyticsOverviewResponse:
        now = datetime.now(UTC)
        safe_period_days = _sanitize_period_days(period_days)
        start_at = _period_start(now, safe_period_days)

        total_grievances = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.created_at >= start_at)
        ) or 0

        escalation_events = db.scalar(
            select(func.count(SLAEvent.id)).where(
                SLAEvent.created_at >= start_at,
                SLAEvent.event_type == SLA_EVENT_ESCALATION,
                SLAEvent.status == SLA_STATUS_TRIGGERED,
            )
        ) or 0

        active_breaches = db.scalar(
            select(func.count(func.distinct(SLAEvent.grievance_id))).where(
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
                SLAEvent.status == SLA_STATUS_BREACHED,
            )
        ) or 0

        return AnalyticsOverviewResponse(
            generated_at=now,
            period_days=safe_period_days,
            total_grievances=int(total_grievances),
            volume_trend=self._volume_trend(
                db,
                start_at=start_at,
                end_date=now.date(),
            ),
            category_distribution=self._category_distribution(db, start_at=start_at),
            department_hotspots=self._department_hotspots(db, start_at=start_at),
            faculty_hotspots=self._faculty_hotspots(db, start_at=start_at),
            backlog=self._backlog_metrics(db, now=now),
            resolution=self._resolution_metrics(db, start_at=start_at),
            sla_compliance=self._sla_compliance(db, start_at=start_at),
            escalation_events=int(escalation_events),
            active_breaches=int(active_breaches),
        )

    def get_topic_clusters(
        self,
        db: Session,
        *,
        period_days: int = 30,
    ) -> AnalyticsTopicClustersResponse:
        now = datetime.now(UTC)
        safe_period_days = _sanitize_period_days(period_days)
        start_at = _period_start(now, safe_period_days)

        clusters = self._nlp_service.cluster_grievances(
            db,
            start_at=start_at,
            limit=500,
        )

        insights = [
            TopicClusterInsight(
                cluster_id=cluster.cluster_id,
                size=cluster.size,
                top_keywords=cluster.top_keywords,
                member_ids=[member.grievance_id for member in cluster.members],
                sample_titles=[member.title for member in cluster.members[:3]],
            )
            for cluster in sorted(clusters, key=lambda item: item.size, reverse=True)
        ]

        return AnalyticsTopicClustersResponse(
            generated_at=now,
            period_days=safe_period_days,
            clusters=insights,
        )
