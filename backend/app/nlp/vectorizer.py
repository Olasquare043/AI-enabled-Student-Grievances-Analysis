from collections import Counter
from math import log, sqrt
import re
from typing import Iterable

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:/[a-z0-9]+)?", re.IGNORECASE)

_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "by",
    "for",
    "from",
    "has",
    "have",
    "had",
    "he",
    "her",
    "his",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "them",
    "there",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "with",
    "you",
    "your",
}


class TfidfVectorizerLite:
    def __init__(
        self,
        *,
        min_df: int = 1,
        max_features: int = 5000,
        include_bigrams: bool = True,
    ) -> None:
        self.min_df = min_df
        self.max_features = max_features
        self.include_bigrams = include_bigrams
        self.vocabulary_: set[str] = set()
        self.idf_: dict[str, float] = {}
        self._is_fitted = False

    def _tokenize(self, text: str) -> list[str]:
        raw_tokens = [token.lower() for token in _TOKEN_PATTERN.findall(text)]
        tokens = [token for token in raw_tokens if token not in _STOP_WORDS and len(token) >= 2]
        if not self.include_bigrams or len(tokens) < 2:
            return tokens

        bigrams = [f"{left}_{right}" for left, right in zip(tokens, tokens[1:])]
        return tokens + bigrams

    def fit(self, documents: Iterable[str]) -> "TfidfVectorizerLite":
        docs = list(documents)
        if not docs:
            self.vocabulary_ = set()
            self.idf_ = {}
            self._is_fitted = True
            return self

        document_frequency: Counter[str] = Counter()
        for document in docs:
            document_tokens = set(self._tokenize(document))
            for token in document_tokens:
                document_frequency[token] += 1

        sorted_tokens = sorted(
            (
                (token, count)
                for token, count in document_frequency.items()
                if count >= self.min_df
            ),
            key=lambda item: (-item[1], item[0]),
        )

        if self.max_features > 0:
            sorted_tokens = sorted_tokens[: self.max_features]

        self.vocabulary_ = {token for token, _ in sorted_tokens}

        document_count = len(docs)
        self.idf_ = {
            token: log((1.0 + document_count) / (1.0 + document_frequency[token])) + 1.0
            for token in self.vocabulary_
        }

        self._is_fitted = True
        return self

    def transform(self, documents: Iterable[str]) -> list[dict[str, float]]:
        if not self._is_fitted:
            raise RuntimeError("Vectorizer must be fitted before transform")

        vectors: list[dict[str, float]] = []
        for document in documents:
            tokens = [token for token in self._tokenize(document) if token in self.vocabulary_]
            token_counts = Counter(tokens)
            if not token_counts:
                vectors.append({})
                continue

            max_count = max(token_counts.values())
            tfidf_vector: dict[str, float] = {}
            for token, count in token_counts.items():
                term_frequency = 0.5 + 0.5 * (count / max_count)
                tfidf_vector[token] = term_frequency * self.idf_.get(token, 1.0)

            norm = sqrt(sum(weight * weight for weight in tfidf_vector.values()))
            if norm > 0:
                tfidf_vector = {
                    token: weight / norm for token, weight in tfidf_vector.items()
                }

            vectors.append(tfidf_vector)

        return vectors

    def fit_transform(self, documents: Iterable[str]) -> list[dict[str, float]]:
        docs = list(documents)
        self.fit(docs)
        return self.transform(docs)
