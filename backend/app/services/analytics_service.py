from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from statistics import median

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.ml.runtime import get_triage_engine
from app.models.audit_log import AuditLog
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
    AnalyticsModelCardResponse,
    AnalyticsOverviewResponse,
    AnalyticsTopicClustersResponse,
    AnalyticsTopicTrendsResponse,
    BacklogMetrics,
    LiveTriageStats,
    ModelCardEntry,
    TopicSpikeAlert,
    TopicTrendSeries,
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
        # A deadline met only after it had passed counts as a breach.
        late = SLAEvent.details["met_after_breach"].as_string() == "true"
        effective_status = case(
            (and_(SLAEvent.status == SLA_STATUS_MET, late), SLA_STATUS_BREACHED),
            else_=SLAEvent.status,
        )
        rows = db.execute(
            select(
                SLAEvent.event_type,
                effective_status.label("status"),
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
            .group_by(SLAEvent.event_type, effective_status)
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
                SLAEvent.created_at >= start_at,
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

    def get_topic_trends(
        self,
        db: Session,
        *,
        period_days: int = 180,
        z: float = 3.0,
        min_count: int = 5,
        history_weeks: int = 8,
    ) -> AnalyticsTopicTrendsResponse:
        """Weekly LDA topic volumes with the same spike rule used in evaluation:
        alert when a week's count exceeds mean + z*std of the previous
        ``history_weeks`` weeks (and at least ``min_count``)."""
        now = datetime.now(UTC)
        safe_period_days = _sanitize_period_days(period_days)
        start_at = _period_start(now, safe_period_days)
        # Align to Monday so buckets are calendar weeks.
        first_week = start_at.date() - timedelta(days=start_at.weekday())
        history_start = first_week - timedelta(weeks=history_weeks)
        n_weeks = (now.date() - first_week).days // 7 + 1
        total_weeks = n_weeks + history_weeks

        catalog = {item["topic_id"]: item for item in get_triage_engine().topic_catalog()}
        rows = db.execute(
            select(Grievance.topic_id, Grievance.created_at).where(
                Grievance.topic_id.is_not(None),
                Grievance.created_at >= datetime.combine(history_start, time.min, tzinfo=UTC),
            )
        ).all()

        counts: dict[int, list[int]] = defaultdict(lambda: [0] * total_weeks)
        for topic_id, created_at in rows:
            index = (_as_utc(created_at).date() - history_start).days // 7
            if 0 <= index < total_weeks:
                counts[int(topic_id)][index] += 1

        def label_for(topic_id: int) -> str:
            words = catalog.get(topic_id, {}).get("top_words", [])
            return ", ".join(words[:3]) if words else f"Topic {topic_id}"

        weeks = [(first_week + timedelta(weeks=i)).isoformat() for i in range(n_weeks)]
        period_total = sum(sum(series[history_weeks:]) for series in counts.values()) or 1
        series_out: list[TopicTrendSeries] = []
        alerts: list[TopicSpikeAlert] = []
        for topic_id, series in counts.items():
            alert_weeks: list[str] = []
            for week in range(history_weeks, total_weeks):
                history = series[week - history_weeks:week]
                mean = sum(history) / len(history)
                std = math.sqrt(sum((value - mean) ** 2 for value in history) / len(history))
                threshold = mean + z * max(std, 1.0)
                if series[week] >= max(min_count, threshold):
                    week_start = weeks[week - history_weeks]
                    alert_weeks.append(week_start)
                    alerts.append(
                        TopicSpikeAlert(
                            topic_id=topic_id,
                            label=label_for(topic_id),
                            week_start=week_start,
                            count=series[week],
                            threshold=round(threshold, 2),
                        )
                    )
            period_counts = series[history_weeks:]
            count = sum(period_counts)
            if count == 0:
                continue
            series_out.append(
                TopicTrendSeries(
                    topic_id=topic_id,
                    label=label_for(topic_id),
                    top_words=catalog.get(topic_id, {}).get("top_words", [])[:8],
                    count=count,
                    share_percent=round(100.0 * count / period_total, 2),
                    weekly_counts=period_counts,
                    alert_weeks=alert_weeks,
                )
            )

        series_out.sort(key=lambda item: item.count, reverse=True)
        alerts.sort(key=lambda item: item.week_start, reverse=True)
        return AnalyticsTopicTrendsResponse(
            generated_at=now,
            period_days=safe_period_days,
            weeks=weeks,
            topics=series_out,
            alerts=alerts,
            method=(
                f"LDA topic per grievance; alert when weekly count > mean + {z:g} x std "
                f"of previous {history_weeks} weeks (minimum {min_count})"
            ),
        )

    def get_model_card(self, db: Session) -> AnalyticsModelCardResponse:
        engine = get_triage_engine()
        metrics = engine.metrics or {}

        triaged = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.predicted_category.is_not(None))
        ) or 0
        auto_routed = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.auto_routed.is_(True))
        ) or 0
        overrides = db.scalar(
            select(func.count(AuditLog.id)).where(
                AuditLog.action == "grievance.category_overridden"
            )
        ) or 0
        stated_pairs = [
            (predicted, (explanation or {}).get("student_category"))
            for predicted, explanation in db.execute(
                select(Grievance.predicted_category, Grievance.ai_explanation).where(
                    Grievance.predicted_category.is_not(None)
                )
            ).all()
        ]
        stated_pairs = [
            (predicted, student)
            for predicted, student in stated_pairs
            if student and student != "other"
        ]
        agreement = (
            round(
                100.0
                * sum(1 for predicted, student in stated_pairs if predicted == student)
                / len(stated_pairs),
                2,
            )
            if stated_pairs
            else None
        )

        live = LiveTriageStats(
            triaged_grievances=int(triaged),
            auto_routed=int(auto_routed),
            auto_route_rate_percent=round(100.0 * auto_routed / triaged, 2) if triaged else 0.0,
            category_overrides=int(overrides),
            override_rate_percent=(
                round(100.0 * overrides / auto_routed, 2) if auto_routed else 0.0
            ),
            agreement_with_student_percent=agreement,
        )

        classification = metrics.get("classification", {})
        topics = metrics.get("topics", {})
        urgency = metrics.get("urgency", {})
        return AnalyticsModelCardResponse(
            available=engine.available,
            model=engine.model_name,
            auto_route_threshold=engine.auto_route_threshold if engine.available else None,
            trained_on=metrics.get("dataset", {}),
            models=[
                ModelCardEntry(name=name, cv_macro_f1=result["cv_macro_f1_mean"], **result["test"])
                for name, result in classification.get("models", {}).items()
            ],
            student_self_selection_accuracy=(
                classification.get("student_self_selection", {}).get("accuracy")
            ),
            per_class=classification.get("per_class", []),
            urgency={
                "lexicon": urgency.get("lexicon", {}),
                "supervised": urgency.get("supervised", {}),
            },
            explainability=metrics.get("explainability", {}),
            topics={
                "best_k": topics.get("best_k"),
                "coherence_table": topics.get("coherence_table", []),
                "events": topics.get("detection", {}).get("events", []),
            },
            live=live,
        )
