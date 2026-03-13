from dataclasses import dataclass
import re

_TOKEN_PATTERN = re.compile(r"[a-z0-9']+", re.IGNORECASE)

_POSITIVE_WORDS = {
    "appreciate",
    "assistance",
    "excellent",
    "fast",
    "fixed",
    "good",
    "great",
    "helpful",
    "resolved",
    "satisfied",
    "supportive",
    "thanks",
}

_NEGATIVE_WORDS = {
    "angry",
    "bad",
    "backlog",
    "blocked",
    "breach",
    "breached",
    "complaint",
    "delay",
    "delayed",
    "denied",
    "disappointed",
    "escalation",
    "error",
    "failed",
    "failure",
    "frustrated",
    "issue",
    "no",
    "not",
    "overdue",
    "poor",
    "problem",
    "risk",
    "unacceptable",
    "unresolved",
    "urgent",
    "worst",
}


@dataclass(frozen=True)
class SentimentResult:
    label: str
    score: float
    positive_hits: int
    negative_hits: int


class SentimentAnalyzer:
    def analyze(self, text: str) -> SentimentResult:
        tokens = [token.lower() for token in _TOKEN_PATTERN.findall(text)]
        if not tokens:
            return SentimentResult(
                label="neutral",
                score=0.0,
                positive_hits=0,
                negative_hits=0,
            )

        positive_hits = sum(1 for token in tokens if token in _POSITIVE_WORDS)
        negative_hits = sum(1 for token in tokens if token in _NEGATIVE_WORDS)

        raw = positive_hits - negative_hits
        normalized_score = raw / max(1.0, len(tokens) ** 0.5)

        if normalized_score >= 0.22:
            label = "positive"
        elif normalized_score <= -0.22:
            label = "negative"
        else:
            label = "neutral"

        return SentimentResult(
            label=label,
            score=round(normalized_score, 4),
            positive_hits=positive_hits,
            negative_hits=negative_hits,
        )
