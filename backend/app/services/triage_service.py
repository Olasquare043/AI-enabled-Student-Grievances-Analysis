"""AI triage: classify, prioritise and (when confident) auto-route a grievance.

This is Stage 2 of the framework. The trained category model decides the
department; routing is automatic only when the model's confidence reaches the
threshold selected during evaluation, otherwise the grievance waits in the
unrouted intake queue for a human (human-in-the-loop).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ml.runtime import get_triage_engine
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.grievance import Grievance
from app.models.grievance_assignment import GrievanceAssignment
from app.nlp.sentiment import SentimentAnalyzer
from app.nlp.urgency import UrgencyAnalyzer
from app.services.sla_service import get_sla_policy_for_department, reset_sla_timers_for_routing

CATEGORY_DEPARTMENT_CODES: dict[str, str] = {
    "academic": "ACADEMIC",
    "bursary": "BURSARY",
    "registry": "REGISTRY",
    "ict": "ICT",
    "hostel": "HOSTEL",
    "security": "SECURITY",
    "welfare": "WELFARE",
}
URGENCY_LEVELS = ("low", "medium", "high", "critical")
PRIORITY_LEVELS = ("P4", "P3", "P2", "P1")

_sentiment = SentimentAnalyzer()
_urgency_lexicon = UrgencyAnalyzer()


@dataclass(frozen=True)
class TriageResult:
    predicted_category: str | None
    confidence: float | None
    sentiment_label: str
    sentiment_score: float
    urgency_label: str
    urgency_score: float
    priority: str
    topic_id: int | None
    explanation: dict[str, Any]
    should_auto_route: bool


def compute_priority(urgency_label: str, sentiment_score: float) -> str:
    """Priority = urgency level, raised one step for strongly negative tone.

    level = index(urgency) + 1[sentiment <= -0.5 and urgency >= medium],
    capped at critical; P1 is the most urgent.
    """
    level = URGENCY_LEVELS.index(urgency_label) if urgency_label in URGENCY_LEVELS else 0
    if sentiment_score <= -0.5 and level >= 1:
        level = min(level + 1, len(URGENCY_LEVELS) - 1)
    return PRIORITY_LEVELS[level]


def analyze(title: str, description: str, *, student_category: str | None = None) -> TriageResult:
    engine = get_triage_engine()
    text = f"{title}. {description}"
    sentiment = _sentiment.analyze(text)
    lexicon = _urgency_lexicon.analyze(text)

    explanation: dict[str, Any] = {
        "student_category": student_category,
        "urgency_reasons": lexicon.reasons,
    }

    predicted: str | None = None
    confidence: float | None = None
    should_route = False
    urgency_label, urgency_score = lexicon.label, lexicon.score
    topic_id: int | None = None

    if engine.available:
        category = engine.classify(title, description)
        predicted, confidence = category.label, category.confidence
        should_route = confidence >= engine.auto_route_threshold
        explanation.update(
            {
                "model": engine.model_name,
                "threshold": engine.auto_route_threshold,
                "category_scores": [{"label": label, "score": score} for label, score in category.scores],
                "top_terms": [{"term": item.term, "weight": item.weight} for item in category.explanation],
            }
        )

        urgency = engine.urgency(title, description)
        if urgency is not None:
            urgency_label, urgency_score = urgency.label, urgency.score
            explanation["urgency_probabilities"] = urgency.probabilities

        topic = engine.topic(title, description)
        if topic is not None:
            topic_id = topic.topic_id
            explanation["topic_words"] = topic.top_words[:6]
            explanation["topic_probability"] = topic.probability

    return TriageResult(
        predicted_category=predicted,
        confidence=confidence,
        sentiment_label=sentiment.label,
        sentiment_score=sentiment.score,
        urgency_label=urgency_label,
        urgency_score=urgency_score,
        priority=compute_priority(urgency_label, sentiment.score),
        topic_id=topic_id,
        explanation=explanation,
        should_auto_route=should_route,
    )


def apply_triage(grievance: Grievance, result: TriageResult) -> None:
    grievance.predicted_category = result.predicted_category
    grievance.category_confidence = result.confidence
    grievance.sentiment_label = result.sentiment_label
    grievance.sentiment_score = result.sentiment_score
    grievance.urgency_label = result.urgency_label
    grievance.urgency_score = result.urgency_score
    grievance.priority = result.priority
    grievance.topic_id = result.topic_id
    grievance.ai_explanation = result.explanation


def department_for_category(db: Session, category: str | None) -> Department | None:
    code = CATEGORY_DEPARTMENT_CODES.get((category or "").lower())
    if code is None:
        return None
    return db.scalar(select(Department).where(Department.code == code, Department.is_active.is_(True)))


def auto_route(db: Session, grievance: Grievance, result: TriageResult) -> bool:
    """Route to the predicted category's department. Caller commits."""
    if not result.should_auto_route:
        return False
    department = department_for_category(db, result.predicted_category)
    if department is None:
        return False
    policy = get_sla_policy_for_department(db, department.id, only_active=True)
    if policy is None:
        return False

    grievance.department_id = department.id
    grievance.category = result.predicted_category or grievance.category
    grievance.auto_routed = True
    db.add(grievance)
    db.add(
        GrievanceAssignment(
            grievance_id=grievance.id,
            department_id=department.id,
            assigned_to_user_id=None,
            assigned_by_user_id=None,
            note=(
                f"Auto-routed by AI triage: {result.predicted_category} "
                f"({round((result.confidence or 0) * 100)}% confidence)."
            ),
        )
    )
    reset_sla_timers_for_routing(
        db,
        grievance,
        department_id=department.id,
        policy=policy,
        routed_by_user_id=None,  # type: ignore[arg-type]  # system actor
    )
    db.add(
        AuditLog(
            user_id=None,
            action="grievance.auto_routed",
            details={
                "grievance_id": str(grievance.id),
                "department_id": department.id,
                "predicted_category": result.predicted_category,
                "confidence": result.confidence,
            },
        )
    )
    return True
