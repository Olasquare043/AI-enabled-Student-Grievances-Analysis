from dataclasses import dataclass
import re

_TOKEN_PATTERN = re.compile(r"[a-z0-9']+", re.IGNORECASE)

_URGENCY_KEYWORDS = {
    "asap": 0.35,
    "deadline": 0.3,
    "emergency": 0.4,
    "immediately": 0.35,
    "now": 0.2,
    "overdue": 0.25,
    "today": 0.2,
    "tomorrow": 0.2,
    "urgent": 0.35,
    "warning": 0.18,
}

_IMPACT_KEYWORDS = {
    "exam": 0.25,
    "graduation": 0.25,
    "registration": 0.2,
    "result": 0.17,
    "safety": 0.3,
    "security": 0.3,
    "tuition": 0.15,
}

_TIME_LIMIT_PATTERN = re.compile(
    r"\b(within\s+\d+\s+(hours?|days?)|\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class UrgencyResult:
    label: str
    score: float
    reasons: list[str]


class UrgencyAnalyzer:
    def analyze(self, text: str) -> UrgencyResult:
        normalized = text.strip()
        if not normalized:
            return UrgencyResult(label="low", score=0.0, reasons=[])

        lowered = normalized.lower()
        tokens = [token.lower() for token in _TOKEN_PATTERN.findall(lowered)]

        score = 0.0
        reasons: list[str] = []

        for keyword, weight in _URGENCY_KEYWORDS.items():
            if keyword in tokens:
                score += weight
                reasons.append(f"keyword:{keyword}")

        for keyword, weight in _IMPACT_KEYWORDS.items():
            if keyword in tokens:
                score += weight
                reasons.append(f"impact:{keyword}")

        if "!" in normalized:
            exclamation_bonus = min(0.2, normalized.count("!") * 0.05)
            score += exclamation_bonus
            reasons.append("punctuation:exclamation")

        if _TIME_LIMIT_PATTERN.search(lowered):
            score += 0.2
            reasons.append("time_constraint")

        uppercase_words = [token for token in normalized.split() if token.isupper() and len(token) > 2]
        if uppercase_words:
            score += min(0.15, len(uppercase_words) * 0.04)
            reasons.append("capitalized_emphasis")

        score = max(0.0, min(1.0, score))

        if score >= 0.8:
            label = "critical"
        elif score >= 0.6:
            label = "high"
        elif score >= 0.35:
            label = "medium"
        else:
            label = "low"

        return UrgencyResult(label=label, score=round(score, 4), reasons=reasons)
