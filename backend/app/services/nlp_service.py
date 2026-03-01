import re
from collections import Counter
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.llm.base import NoOpLLMProvider
from app.models.grievance import Grievance
from app.nlp.classifier import TfidfLinearClassifier
from app.nlp.sentiment import SentimentAnalyzer
from app.nlp.topic_cluster import TopicClusterer
from app.nlp.urgency import UrgencyAnalyzer
from app.schemas.grievance import ensure_grievance_status
from app.schemas.nlp import (
    NLPCategoryScore,
    NLPClusterMember,
    NLPGrievanceAnalysisResponse,
    NLPSentimentResult,
    NLPTextAnalysisResponse,
    NLPTopicClusterResponse,
    NLPUrgencyResult,
)
from app.services.llm_enrichment_service import LLMEnrichmentService

_WORD_PATTERN = re.compile(r"[a-z0-9]+", re.IGNORECASE)
_DATE_PATTERN = re.compile(
    r"\b(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b",
    re.IGNORECASE,
)
_MATRIC_PATTERN = re.compile(r"\b[A-Z]{2,6}/\d{2}/\d{2,6}\b")
_COURSE_CODE_PATTERN = re.compile(r"\b[A-Z]{3}\d{3}\b")
_PAYMENT_REF_PATTERN = re.compile(r"\b(?:REF|RRR|PAY)[:\-]?[A-Z0-9]{6,20}\b", re.IGNORECASE)

_DEPARTMENT_KEYWORDS = {
    "ict": ["internet", "network", "portal", "system", "website", "wifi", "server"],
    "bursary": ["tuition", "payment", "fee", "invoice", "refund", "bursary", "receipt"],
    "registry": ["transcript", "admission", "certificate", "record", "clearance", "registry"],
    "hostel": ["hostel", "accommodation", "room", "bedspace", "hall", "maintenance"],
    "security": ["security", "theft", "harassment", "unsafe", "threat", "violence"],
    "academic": ["lecture", "course", "exam", "result", "grade", "attendance"],
    "welfare": ["counseling", "health", "welfare", "support", "wellbeing", "clinic"],
}

_BOOTSTRAP_CORPUS: tuple[tuple[str, str], ...] = (
    ("The student portal keeps throwing authentication errors during login.", "ict"),
    ("Campus WiFi in the engineering block is unavailable since Monday.", "ict"),
    ("Online registration system fails when uploading payment confirmation.", "ict"),
    ("Tuition payment is debited but no receipt is generated.", "bursary"),
    ("I paid acceptance fee and the bursary still marks me as owing.", "bursary"),
    ("Refund request has not been processed after multiple visits.", "bursary"),
    ("Transcript request has been pending for over two months.", "registry"),
    ("My admission record has a wrong date of birth on the portal.", "registry"),
    ("Graduation clearance document is missing at the registry office.", "registry"),
    ("Hostel room plumbing has been leaking for two weeks.", "hostel"),
    ("Allocated hostel bedspace was given to another student.", "hostel"),
    ("Power outage in hostel block C has not been resolved.", "hostel"),
    ("A stolen laptop case was reported but no follow-up from security.", "security"),
    ("Students reported harassment near the main gate at night.", "security"),
    ("Security checkpoint denied access despite valid ID card.", "security"),
    ("Exam timetable conflict affects two compulsory courses.", "academic"),
    ("Result upload for CSC301 is still missing weeks after exams.", "academic"),
    ("Lecturer attendance has been inconsistent and classes are skipped.", "academic"),
    ("Student counseling appointment has been delayed repeatedly.", "welfare"),
    ("Clinic denied treatment despite valid health registration.", "welfare"),
    ("Disability support accommodation request was ignored.", "welfare"),
)


class NLPService:
    def __init__(self) -> None:
        self.sentiment = SentimentAnalyzer()
        self.urgency = UrgencyAnalyzer()
        self.clusterer = TopicClusterer()
        self.llm = LLMEnrichmentService()
        self.noop = NoOpLLMProvider()

    def _build_training_samples(self, db: Session) -> tuple[list[str], list[str]]:
        texts: list[str] = []
        labels: list[str] = []

        rows = list(
            db.execute(
                select(Grievance.title, Grievance.description, Grievance.category)
                .where(Grievance.category.is_not(None))
                .order_by(Grievance.created_at.desc())
                .limit(2000)
            ).all()
        )

        for title, description, category in rows:
            category_name = (category or "").strip().lower()
            if not category_name:
                continue
            text = f"{title or ''}\n{description or ''}".strip()
            if not text:
                continue
            texts.append(text)
            labels.append(category_name)

        unique_categories = {label for label in labels}
        needs_bootstrap = len(texts) < 12 or len(unique_categories) < 3
        if needs_bootstrap:
            for text, category in _BOOTSTRAP_CORPUS:
                texts.append(text)
                labels.append(category)

        return texts, labels

    def _fit_classifier(self, db: Session) -> TfidfLinearClassifier:
        texts, labels = self._build_training_samples(db)
        classifier = TfidfLinearClassifier()
        classifier.fit(texts, labels)
        return classifier

    def _extract_baseline_entities(self, text: str) -> dict[str, Any]:
        lowered = text.lower()
        words = [token.lower() for token in _WORD_PATTERN.findall(lowered) if len(token) > 2]
        top_keywords = [token for token, _ in Counter(words).most_common(12)]

        departments = [
            department
            for department, keywords in _DEPARTMENT_KEYWORDS.items()
            if any(keyword in lowered for keyword in keywords)
        ]

        entities: dict[str, Any] = {
            "departments": sorted(set(departments)),
            "course_codes": sorted(set(_COURSE_CODE_PATTERN.findall(text.upper()))),
            "matric_numbers": sorted(set(_MATRIC_PATTERN.findall(text.upper()))),
            "payment_references": sorted(
                set(_PAYMENT_REF_PATTERN.findall(text.upper()))
            ),
            "dates": sorted({match[0] for match in _DATE_PATTERN.findall(text.lower())}),
            "keywords": top_keywords,
        }
        return entities

    def _merge_entities(self, baseline: dict[str, Any], llm_entities: dict[str, Any]) -> dict[str, Any]:
        merged: dict[str, Any] = dict(baseline)
        for key, value in llm_entities.items():
            current_value = merged.get(key)
            if isinstance(current_value, list) and isinstance(value, list):
                merged[key] = sorted(
                    {
                        str(item).strip()
                        for item in current_value + value
                        if str(item).strip()
                    }
                )
            elif isinstance(current_value, dict) and isinstance(value, dict):
                merged[key] = {**current_value, **value}
            else:
                merged[key] = value
        return merged

    def analyze_text(
        self,
        db: Session,
        text: str,
        *,
        include_llm_enrichment: bool = True,
    ) -> NLPTextAnalysisResponse:
        cleaned_text = text.strip()
        if not cleaned_text:
            raise ValueError("Text cannot be empty")

        classifier = self._fit_classifier(db)
        category_prediction = classifier.predict(cleaned_text, top_k=3)

        sentiment = self.sentiment.analyze(cleaned_text)
        urgency = self.urgency.analyze(cleaned_text)
        summary = self.noop.summarize(cleaned_text)

        entities = self._extract_baseline_entities(cleaned_text)
        provider_name = "none"

        if include_llm_enrichment:
            provider_name = self.llm.provider_name
            llm_summary, llm_entities = self.llm.enrich_text(cleaned_text)
            if llm_summary:
                summary = llm_summary
            if llm_entities:
                entities = self._merge_entities(entities, llm_entities)

        return NLPTextAnalysisResponse(
            provider=provider_name,
            predicted_category=category_prediction.label,
            category_confidence=round(category_prediction.confidence, 4),
            category_suggestions=[
                NLPCategoryScore(label=item.label, score=round(item.score, 4))
                for item in category_prediction.scores
            ],
            sentiment=NLPSentimentResult(
                label=sentiment.label,
                score=sentiment.score,
                positive_hits=sentiment.positive_hits,
                negative_hits=sentiment.negative_hits,
            ),
            urgency=NLPUrgencyResult(
                label=urgency.label,
                score=urgency.score,
                reasons=urgency.reasons,
            ),
            summary=summary,
            entities=entities,
        )

    def analyze_grievance(
        self,
        db: Session,
        grievance: Grievance,
        *,
        include_llm_enrichment: bool = True,
    ) -> NLPGrievanceAnalysisResponse:
        combined_text = f"{grievance.title}\n\n{grievance.description}".strip()
        analysis = self.analyze_text(
            db,
            combined_text,
            include_llm_enrichment=include_llm_enrichment,
        )

        return NLPGrievanceAnalysisResponse(
            grievance_id=grievance.id,
            source_category=grievance.category,
            **analysis.model_dump(),
        )

    def cluster_grievances(
        self,
        db: Session,
        *,
        status: str | None = None,
        category: str | None = None,
        department_id: int | None = None,
        start_at: datetime | None = None,
        limit: int = 200,
    ) -> list[NLPTopicClusterResponse]:
        status_filter = ensure_grievance_status(status) if status else None
        category_filter = category.strip().lower() if category else None

        stmt = (
            select(Grievance)
            .order_by(Grievance.created_at.desc())
            .limit(limit)
        )

        if status_filter:
            stmt = stmt.where(Grievance.status == status_filter)
        if category_filter:
            stmt = stmt.where(Grievance.category == category_filter)
        if department_id:
            stmt = stmt.where(Grievance.department_id == department_id)
        if start_at is not None:
            stmt = stmt.where(Grievance.created_at >= start_at)

        grievances = list(db.scalars(stmt))
        if not grievances:
            return []

        documents = [f"{grievance.title}\n{grievance.description}" for grievance in grievances]
        clusters = self.clusterer.cluster(documents)

        output: list[NLPTopicClusterResponse] = []
        for cluster in clusters:
            members: list[NLPClusterMember] = []
            for member_index in cluster.member_indexes:
                grievance = grievances[member_index]
                members.append(
                    NLPClusterMember(
                        grievance_id=grievance.id,
                        title=grievance.title,
                        category=grievance.category,
                        status=grievance.status,
                        created_at=grievance.created_at,
                    )
                )

            output.append(
                NLPTopicClusterResponse(
                    cluster_id=cluster.id,
                    size=cluster.size,
                    top_keywords=cluster.top_keywords,
                    members=members,
                )
            )

        return output



