from dataclasses import dataclass
from math import exp, log
from typing import Iterable

from app.nlp.vectorizer import TfidfVectorizerLite


@dataclass(frozen=True)
class CategoryScore:
    label: str
    score: float


@dataclass(frozen=True)
class PredictionResult:
    label: str
    confidence: float
    scores: list[CategoryScore]


class TfidfLinearClassifier:
    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizerLite(min_df=1, max_features=6000)
        self.class_centroids: dict[str, dict[str, float]] = {}
        self.class_priors: dict[str, float] = {}
        self._is_fitted = False

    @staticmethod
    def _dot(a: dict[str, float], b: dict[str, float]) -> float:
        if len(a) > len(b):
            a, b = b, a
        return sum(value * b.get(token, 0.0) for token, value in a.items())

    @staticmethod
    def _average_vectors(vectors: list[dict[str, float]]) -> dict[str, float]:
        if not vectors:
            return {}

        totals: dict[str, float] = {}
        for vector in vectors:
            for token, value in vector.items():
                totals[token] = totals.get(token, 0.0) + value

        count = float(len(vectors))
        return {token: value / count for token, value in totals.items()}

    def fit(self, texts: Iterable[str], labels: Iterable[str]) -> "TfidfLinearClassifier":
        text_list = list(texts)
        label_list = list(labels)
        if len(text_list) != len(label_list):
            raise ValueError("Texts and labels must have equal length")
        if not text_list:
            raise ValueError("Cannot fit classifier without training examples")

        vectors = self.vectorizer.fit_transform(text_list)

        label_to_vectors: dict[str, list[dict[str, float]]] = {}
        for vector, label in zip(vectors, label_list):
            label_to_vectors.setdefault(label, []).append(vector)

        total_samples = float(len(label_list))
        self.class_centroids = {
            label: self._average_vectors(items)
            for label, items in label_to_vectors.items()
        }
        self.class_priors = {
            label: len(items) / total_samples for label, items in label_to_vectors.items()
        }

        self._is_fitted = True
        return self

    def predict(self, text: str, *, top_k: int = 3) -> PredictionResult:
        if not self._is_fitted:
            raise RuntimeError("Classifier must be fitted before prediction")

        vector = self.vectorizer.transform([text])[0]
        if not vector:
            label = max(self.class_priors, key=self.class_priors.get)
            return PredictionResult(
                label=label,
                confidence=0.0,
                scores=[
                    CategoryScore(label=item_label, score=0.0)
                    for item_label in sorted(self.class_priors)
                ],
            )

        raw_scores: dict[str, float] = {}
        for label, centroid in self.class_centroids.items():
            prior = max(self.class_priors.get(label, 1e-9), 1e-9)
            raw_scores[label] = self._dot(vector, centroid) + log(prior)

        max_score = max(raw_scores.values())
        exp_scores = {
            label: exp(score - max_score) for label, score in raw_scores.items()
        }
        exp_total = sum(exp_scores.values()) or 1.0

        ranked_scores = sorted(
            (
                CategoryScore(label=label, score=value / exp_total)
                for label, value in exp_scores.items()
            ),
            key=lambda item: item.score,
            reverse=True,
        )

        top_scores = ranked_scores[: max(1, top_k)]
        best = top_scores[0]

        return PredictionResult(
            label=best.label,
            confidence=best.score,
            scores=top_scores,
        )
