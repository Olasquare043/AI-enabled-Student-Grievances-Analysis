"""Runtime inference with the trained artifacts produced by ``app.ml.train``.

Artifacts are loaded once per process. When they are missing the engine
reports ``available = False`` and callers fall back to the lexicon/centroid
baseline in ``app.nlp``.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.ml.text import build_text

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
URGENCY_ORDER = ("low", "medium", "high", "critical")


@dataclass(frozen=True)
class TermContribution:
    term: str
    weight: float


@dataclass(frozen=True)
class CategoryPrediction:
    label: str
    confidence: float
    scores: list[tuple[str, float]]
    explanation: list[TermContribution]


@dataclass(frozen=True)
class UrgencyPrediction:
    label: str
    score: float  # expected urgency level scaled to 0..1
    probabilities: dict[str, float]


@dataclass(frozen=True)
class TopicAssignment:
    topic_id: int
    probability: float
    top_words: list[str]


def _softmax(scores: np.ndarray) -> np.ndarray:
    shifted = scores - scores.max()
    exp = np.exp(shifted)
    return exp / exp.sum()


class TriageEngine:
    def __init__(self, artifact_dir: Path = ARTIFACT_DIR) -> None:
        self.artifact_dir = artifact_dir
        self._lock = threading.Lock()
        self._loaded = False
        self._classifier: dict[str, Any] | None = None
        self._urgency: dict[str, Any] | None = None
        self._topics: dict[str, Any] | None = None
        self._metrics: dict[str, Any] | None = None

    def _load(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            import joblib

            # joblib uses pickle; these files are built by app.ml.train and ship
            # with the code. Never point artifact_dir at user-supplied files.
            def maybe(name: str):
                path = self.artifact_dir / name
                return joblib.load(path) if path.exists() else None

            self._classifier = maybe("classifier.joblib")
            if self._classifier is not None:
                self._classifier["vocabulary"] = (
                    self._classifier["pipeline"].named_steps["tfidf"].get_feature_names_out()
                )
            self._urgency = maybe("urgency.joblib")
            self._topics = maybe("topics.joblib")
            metrics_path = self.artifact_dir / "metrics.json"
            if metrics_path.exists():
                self._metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
            self._loaded = True

    # ------------------------------------------------------------------ status
    @property
    def available(self) -> bool:
        self._load()
        return self._classifier is not None

    @property
    def model_name(self) -> str:
        self._load()
        return self._classifier["model_name"] if self._classifier else "centroid-baseline"

    @property
    def auto_route_threshold(self) -> float:
        self._load()
        return float(self._classifier["auto_route_threshold"]) if self._classifier else 1.01

    @property
    def metrics(self) -> dict[str, Any] | None:
        self._load()
        return self._metrics

    # ------------------------------------------------------------------ category
    def classify(self, title: str | None, description: str | None, *, top_terms: int = 6) -> CategoryPrediction:
        self._load()
        if self._classifier is None:
            raise RuntimeError("Classifier artifact is not available")

        pipeline = self._classifier["pipeline"]
        vectorizer = pipeline.named_steps["tfidf"]
        model = pipeline.named_steps["clf"]
        features = vectorizer.transform([build_text(title, description)])

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(features)[0]
        else:
            probabilities = _softmax(model.decision_function(features)[0])
        classes = list(model.classes_)
        best = int(np.argmax(probabilities))
        ranked = sorted(zip(classes, probabilities), key=lambda item: item[1], reverse=True)

        # Linear SHAP: phi_j = w_cj * (x_j - E[x_j]) for the predicted class c.
        weights = model.coef_ if hasattr(model, "coef_") else model.feature_log_prob_
        row = features.tocsr()
        background = self._classifier["background"]
        present = row.indices
        explanation: list[TermContribution] = []
        if len(present):
            phi = weights[best, present] * (row.data - background[present])
            vocabulary = self._classifier["vocabulary"]
            order = np.argsort(phi)[::-1]
            explanation = [
                TermContribution(term=str(vocabulary[present[i]]), weight=round(float(phi[i]), 4))
                for i in order[:top_terms]
                if phi[i] > 0
            ]

        return CategoryPrediction(
            label=str(classes[best]),
            confidence=round(float(probabilities[best]), 4),
            scores=[(str(label), round(float(score), 4)) for label, score in ranked[:3]],
            explanation=explanation,
        )

    # ------------------------------------------------------------------ urgency
    def urgency(self, title: str | None, description: str | None) -> UrgencyPrediction | None:
        self._load()
        if self._urgency is None:
            return None
        pipeline = self._urgency["pipeline"]
        probabilities = pipeline.predict_proba([build_text(title, description)])[0]
        classes = list(pipeline.classes_)
        by_label = {str(label): float(prob) for label, prob in zip(classes, probabilities)}
        expected = sum(URGENCY_ORDER.index(label) * prob for label, prob in by_label.items())
        label = max(by_label, key=by_label.get)
        return UrgencyPrediction(
            label=label,
            score=round(expected / (len(URGENCY_ORDER) - 1), 4),
            probabilities={key: round(value, 4) for key, value in by_label.items()},
        )

    # ------------------------------------------------------------------ topics
    def topic(self, title: str | None, description: str | None) -> TopicAssignment | None:
        self._load()
        if self._topics is None:
            return None
        counts = self._topics["vectorizer"].transform([build_text(title, description)])
        if counts.nnz == 0:
            return None
        distribution = self._topics["lda"].transform(counts)[0]
        topic_id = int(np.argmax(distribution))
        return TopicAssignment(
            topic_id=topic_id,
            probability=round(float(distribution[topic_id]), 4),
            top_words=list(self._topics["topics"][topic_id]["top_words"]),
        )

    def topic_catalog(self) -> list[dict[str, Any]]:
        self._load()
        return list(self._topics["topics"]) if self._topics else []


@lru_cache
def get_triage_engine() -> TriageEngine:
    return TriageEngine()
