from dataclasses import dataclass
from typing import Sequence

from app.nlp.vectorizer import TfidfVectorizerLite


@dataclass(frozen=True)
class TopicCluster:
    id: int
    size: int
    member_indexes: list[int]
    top_keywords: list[str]


class TopicClusterer:
    def __init__(self, *, similarity_threshold: float = 0.27) -> None:
        self.similarity_threshold = similarity_threshold

    @staticmethod
    def _dot(a: dict[str, float], b: dict[str, float]) -> float:
        if len(a) > len(b):
            a, b = b, a
        return sum(value * b.get(token, 0.0) for token, value in a.items())

    @staticmethod
    def _mean_vector(vectors: Sequence[dict[str, float]]) -> dict[str, float]:
        if not vectors:
            return {}

        totals: dict[str, float] = {}
        for vector in vectors:
            for token, value in vector.items():
                totals[token] = totals.get(token, 0.0) + value

        count = float(len(vectors))
        return {token: value / count for token, value in totals.items()}

    def cluster(self, documents: Sequence[str]) -> list[TopicCluster]:
        if not documents:
            return []

        vectorizer = TfidfVectorizerLite(min_df=1, max_features=5000)
        vectors = vectorizer.fit_transform(documents)

        clusters: list[dict[str, object]] = []

        for index, vector in enumerate(vectors):
            best_cluster_index = -1
            best_similarity = -1.0

            for cluster_index, cluster in enumerate(clusters):
                centroid = cluster["centroid"]
                similarity = self._dot(vector, centroid) if isinstance(centroid, dict) else 0.0
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_cluster_index = cluster_index

            if best_cluster_index >= 0 and best_similarity >= self.similarity_threshold:
                target = clusters[best_cluster_index]
                member_indexes = target["member_indexes"]
                member_vectors = target["member_vectors"]
                if isinstance(member_indexes, list) and isinstance(member_vectors, list):
                    member_indexes.append(index)
                    member_vectors.append(vector)
                    target["centroid"] = self._mean_vector(member_vectors)
            else:
                clusters.append(
                    {
                        "member_indexes": [index],
                        "member_vectors": [vector],
                        "centroid": vector,
                    }
                )

        output: list[TopicCluster] = []
        for cluster_index, cluster in enumerate(clusters, start=1):
            member_indexes = cluster["member_indexes"]
            member_vectors = cluster["member_vectors"]
            centroid = cluster["centroid"]

            if not isinstance(member_indexes, list) or not isinstance(member_vectors, list) or not isinstance(centroid, dict):
                continue

            top_keywords = [
                token
                for token, _ in sorted(
                    centroid.items(),
                    key=lambda item: item[1],
                    reverse=True,
                )[:5]
            ]

            output.append(
                TopicCluster(
                    id=cluster_index,
                    size=len(member_indexes),
                    member_indexes=member_indexes,
                    top_keywords=top_keywords,
                )
            )

        output.sort(key=lambda cluster: cluster.size, reverse=True)
        return output
