"""Train, evaluate and export the grievance-analysis models.

Usage:
    python -m app.ml.train                 # train + evaluate + write artifacts
    python -m app.ml.train --figures DIR   # also write thesis figures (needs matplotlib)
    python -m app.ml.train --if-missing    # only train if artifacts are absent

Pipeline (all steps deterministic with --seed):
  1. Load backend/data/grievances_synthetic.csv; stratified 80/20 split.
  2. Category classifiers: Centroid baseline (eq. 3.4-3.7), Multinomial NB,
     Logistic Regression, Linear SVM. Hyper-parameters by 5-fold grid search on
     the training split; best model chosen by CV macro-F1; final scores on the
     untouched test split. McNemar test of best model vs the centroid baseline.
  3. Auto-routing threshold: coverage/accuracy trade-off of softmax confidence.
  4. Explainability: Linear SHAP contributions + deletion-based faithfulness
     test (Wilcoxon signed-rank vs random deletion).
  5. Urgency: lexicon heuristic (eq. 3.9) vs supervised TF-IDF + LR.
  6. Topic modelling: LDA with k chosen by NPMI coherence; weekly spike
     detection evaluated against the planted emerging issues.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
from scipy import stats
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.svm import LinearSVC

from app.data_gen.scenarios import PLANTED_EVENTS
from app.data_gen.generate_dataset import START_DATE
from app.ml.text import STOP_WORDS, TOKEN_PATTERN, TOPIC_STOP_WORDS, build_text
from app.nlp.classifier import TfidfLinearClassifier
from app.nlp.sentiment import SentimentAnalyzer
from app.nlp.urgency import UrgencyAnalyzer

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BACKEND_DIR / "data" / "grievances_synthetic.csv"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
URGENCY_ORDER = ["low", "medium", "high", "critical"]
TARGET_AUTO_ROUTE_ACCURACY = 0.97


# --------------------------------------------------------------------------- helpers
def load_dataset(path: Path = DATA_PATH) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["text"] = build_text(row["title"], row["description"])
    return rows


def tfidf() -> TfidfVectorizer:
    # smooth_idf=True gives idf(t) = ln((1+N)/(1+df(t))) + 1, i.e. eq. 3.2.
    return TfidfVectorizer(
        token_pattern=TOKEN_PATTERN,
        stop_words=STOP_WORDS,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
        smooth_idf=True,
    )


def softmax(scores: np.ndarray) -> np.ndarray:
    shifted = scores - scores.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def class_probabilities(pipeline: Pipeline, texts) -> np.ndarray:
    model = pipeline.named_steps["clf"]
    features = pipeline.named_steps["tfidf"].transform(texts)
    if hasattr(model, "predict_proba"):
        return model.predict_proba(features)
    return softmax(model.decision_function(features))


class CentroidBaseline(BaseEstimator, ClassifierMixin):
    """sklearn adapter around the original centroid classifier (eq. 3.4-3.7).

    ``use_prior=False`` replaces P(c) with a uniform prior, which isolates the
    effect of the log-prior term in eq. 3.5.
    """

    def __init__(self, use_prior: bool = True) -> None:
        self.use_prior = use_prior

    def fit(self, texts, labels):
        self.model_ = TfidfLinearClassifier().fit(list(texts), list(labels))
        if not self.use_prior:
            uniform = 1.0 / len(self.model_.class_priors)
            self.model_.class_priors = {label: uniform for label in self.model_.class_priors}
        self.classes_ = np.array(sorted(set(labels)))
        return self

    def predict(self, texts):
        return np.array([self.model_.predict(text, top_k=1).label for text in texts])


def macro_scores(y_true, y_pred) -> dict[str, float]:
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_precision": round(float(precision), 4),
        "macro_recall": round(float(recall), 4),
        "macro_f1": round(float(f1), 4),
    }


def per_class(y_true, y_pred, labels) -> list[dict[str, object]]:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    return [
        {
            "label": label,
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
            "support": int(s),
        }
        for label, p, r, f, s in zip(labels, precision, recall, f1, support)
    ]


def mcnemar(y_true, pred_a, pred_b) -> dict[str, float]:
    """McNemar's test with continuity correction (Dietterich, 1998)."""
    a_right = np.asarray(pred_a) == np.asarray(y_true)
    b_right = np.asarray(pred_b) == np.asarray(y_true)
    b = int(np.sum(a_right & ~b_right))
    c = int(np.sum(~a_right & b_right))
    statistic = ((abs(b - c) - 1) ** 2) / (b + c) if (b + c) else 0.0
    p_value = float(stats.chi2.sf(statistic, df=1))
    return {"a_only_correct": b, "b_only_correct": c, "chi2": round(statistic, 4), "p_value": p_value}


# --------------------------------------------------------------------------- 1-3 classification
def train_classifiers(train_rows, test_rows, seed: int) -> dict[str, object]:
    x_train = [row["text"] for row in train_rows]
    y_train = [row["true_category"] for row in train_rows]
    x_test = [row["text"] for row in test_rows]
    y_test = [row["true_category"] for row in test_rows]
    labels = sorted(set(y_train))
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)

    candidates = {
        "Multinomial Naive Bayes": (
            Pipeline([("tfidf", tfidf()), ("clf", MultinomialNB())]),
            {"clf__alpha": [0.01, 0.05, 0.1, 0.5]},
        ),
        "Logistic Regression": (
            Pipeline([("tfidf", tfidf()), ("clf", LogisticRegression(max_iter=3000))]),
            {"clf__C": [1, 5, 10, 30]},
        ),
        "Linear SVM": (
            Pipeline([("tfidf", tfidf()), ("clf", LinearSVC(random_state=seed))]),
            {"clf__C": [0.1, 0.3, 1, 3]},
        ),
    }

    results: dict[str, dict[str, object]] = {}
    fitted: dict[str, object] = {}

    baseline = CentroidBaseline()
    baseline_cv = cross_val_score(baseline, x_train, y_train, cv=cv, scoring="f1_macro")
    baseline.fit(x_train, y_train)
    baseline_pred = baseline.predict(x_test)
    results["Centroid (baseline)"] = {
        "cv_macro_f1_mean": round(float(baseline_cv.mean()), 4),
        "cv_macro_f1_std": round(float(baseline_cv.std()), 4),
        "best_params": {},
        "test": macro_scores(y_test, baseline_pred),
    }
    fitted["Centroid (baseline)"] = baseline

    no_prior = CentroidBaseline(use_prior=False)
    no_prior_cv = cross_val_score(no_prior, x_train, y_train, cv=cv, scoring="f1_macro")
    no_prior.fit(x_train, y_train)
    no_prior_pred = no_prior.predict(x_test)
    results["Centroid (uniform prior)"] = {
        "cv_macro_f1_mean": round(float(no_prior_cv.mean()), 4),
        "cv_macro_f1_std": round(float(no_prior_cv.std()), 4),
        "best_params": {},
        "test": macro_scores(y_test, no_prior_pred),
    }

    predictions = {"Centroid (baseline)": baseline_pred}
    for name, (pipeline, grid) in candidates.items():
        search = GridSearchCV(pipeline, grid, cv=cv, scoring="f1_macro", n_jobs=1)
        search.fit(x_train, y_train)
        best_index = search.best_index_
        pred = search.best_estimator_.predict(x_test)
        predictions[name] = pred
        fitted[name] = search.best_estimator_
        results[name] = {
            "cv_macro_f1_mean": round(float(search.cv_results_["mean_test_score"][best_index]), 4),
            "cv_macro_f1_std": round(float(search.cv_results_["std_test_score"][best_index]), 4),
            "best_params": {key.replace("clf__", ""): value for key, value in search.best_params_.items()},
            "test": macro_scores(y_test, pred),
        }

    # One-standard-error rule (Hastie et al., 2009): among models whose CV score
    # is within one standard deviation of the best, prefer one that outputs
    # calibrated probabilities, since routing depends on a confidence threshold.
    top_name = max(candidates, key=lambda name: results[name]["cv_macro_f1_mean"])
    floor = results[top_name]["cv_macro_f1_mean"] - results[top_name]["cv_macro_f1_std"]
    tied = [name for name in candidates if results[name]["cv_macro_f1_mean"] >= floor]
    probabilistic = [
        name for name in tied if hasattr(fitted[name].named_steps["clf"], "predict_proba")
    ]
    best_name = max(probabilistic or tied, key=lambda name: results[name]["cv_macro_f1_mean"])
    selection_note = (
        f"Highest CV macro-F1: {top_name}. Selected: {best_name} "
        f"(within one SD of the best{' and provides calibrated probabilities' if probabilistic else ''})."
    )
    best_pipeline: Pipeline = fitted[best_name]  # type: ignore[assignment]
    best_pred = predictions[best_name]

    student_pred = [row["student_selected_category"] for row in test_rows]

    # Auto-routing threshold analysis.
    probabilities = class_probabilities(best_pipeline, x_test)
    confidence = probabilities.max(axis=1)
    correct = np.asarray(best_pred) == np.asarray(y_test)
    threshold_table = []
    for threshold in np.round(np.arange(0.20, 0.96, 0.05), 2):
        mask = confidence >= threshold
        coverage = float(mask.mean())
        accuracy = float(correct[mask].mean()) if mask.any() else float("nan")
        threshold_table.append(
            {"threshold": float(threshold), "coverage": round(coverage, 4), "accuracy": round(accuracy, 4)}
        )
    # Lowest threshold whose auto-routed accuracy reaches the target.
    chosen = next(
        (row for row in threshold_table if row["accuracy"] >= TARGET_AUTO_ROUTE_ACCURACY),
        threshold_table[-1],
    )

    return {
        "labels": labels,
        "results": results,
        "best_model": best_name,
        "selection_note": selection_note,
        "pipeline": best_pipeline,
        "test_confusion_matrix": confusion_matrix(y_test, best_pred, labels=labels).tolist(),
        "baseline_confusion_matrix": confusion_matrix(y_test, baseline_pred, labels=labels).tolist(),
        "per_class": per_class(y_test, best_pred, labels),
        "student_self_selection": macro_scores(y_test, student_pred),
        "mcnemar_best_vs_baseline": mcnemar(y_test, best_pred, baseline_pred),
        "mcnemar_best_vs_uniform_centroid": mcnemar(y_test, best_pred, no_prior_pred),
        "mcnemar_best_vs_student": mcnemar(y_test, best_pred, student_pred),
        "threshold_table": threshold_table,
        "auto_route_threshold": chosen["threshold"],
        "auto_route_at_threshold": chosen,
        "ambiguous_test_accuracy": round(
            float(np.mean([p == t for p, t, row in zip(best_pred, y_test, test_rows) if row["is_ambiguous"] == "1"])), 4
        ),
        "confidence": confidence,
        "correct": correct,
    }


# --------------------------------------------------------------------------- 4 explainability
def linear_weights(pipeline: Pipeline) -> np.ndarray:
    model = pipeline.named_steps["clf"]
    if hasattr(model, "coef_"):
        return np.asarray(model.coef_)
    return np.asarray(model.feature_log_prob_)


def shap_faithfulness(pipeline: Pipeline, train_texts, test_texts, seed: int, k: int = 3) -> dict[str, object]:
    """Deletion test: removing the top-k SHAP features should hurt the predicted
    class probability more than removing k random present features."""
    rng = np.random.default_rng(seed)
    vectorizer = pipeline.named_steps["tfidf"]
    model = pipeline.named_steps["clf"]
    weights = linear_weights(pipeline)
    background = np.asarray(vectorizer.transform(train_texts).mean(axis=0)).ravel()

    def prob(matrix) -> np.ndarray:
        if hasattr(model, "predict_proba"):
            return model.predict_proba(matrix)
        return softmax(model.decision_function(matrix))

    features = vectorizer.transform(test_texts).tocsr()
    base = prob(features)
    predicted = base.argmax(axis=1)
    shap_drops, random_drops, shap_flips, random_flips = [], [], [], []

    for row_index in range(features.shape[0]):
        row = features[row_index]
        present = row.indices
        if len(present) <= k:
            continue
        cls = predicted[row_index]
        phi = weights[cls, present] * (row.data - background[present])
        top = present[np.argsort(phi)[::-1][:k]]
        rand = rng.choice(present, size=k, replace=False)
        for chosen, drops, flips in ((top, shap_drops, shap_flips), (rand, random_drops, random_flips)):
            edited = row.copy().toarray()
            edited[0, chosen] = 0.0
            p = prob(edited)[0]
            drops.append(float(base[row_index, cls] - p[cls]))
            flips.append(bool(p.argmax() != cls))

    wilcoxon = stats.wilcoxon(shap_drops, random_drops, alternative="greater")
    return {
        "k": k,
        "documents": len(shap_drops),
        "mean_prob_drop_shap": round(float(np.mean(shap_drops)), 4),
        "mean_prob_drop_random": round(float(np.mean(random_drops)), 4),
        "flip_rate_shap": round(float(np.mean(shap_flips)), 4),
        "flip_rate_random": round(float(np.mean(random_flips)), 4),
        "wilcoxon_statistic": float(wilcoxon.statistic),
        "wilcoxon_p_value": float(wilcoxon.pvalue),
        "background": background,
    }


# --------------------------------------------------------------------------- 5 urgency
def train_urgency(train_rows, test_rows, seed: int) -> dict[str, object]:
    x_train = [row["text"] for row in train_rows]
    y_train = [row["expected_urgency"] for row in train_rows]
    x_test = [row["text"] for row in test_rows]
    y_test = [row["expected_urgency"] for row in test_rows]

    analyzer = UrgencyAnalyzer()
    lexicon_pred = [analyzer.analyze(f"{row['title']}. {row['description']}").label for row in test_rows]

    pipeline = Pipeline(
        [("tfidf", tfidf()), ("clf", LogisticRegression(max_iter=3000, class_weight="balanced"))]
    )
    search = GridSearchCV(
        pipeline,
        {"clf__C": [0.5, 1, 3, 10]},
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=seed),
        scoring="f1_macro",
    )
    search.fit(x_train, y_train)
    supervised_pred = search.best_estimator_.predict(x_test)

    def within_one(pred) -> float:
        return round(
            float(np.mean([abs(URGENCY_ORDER.index(p) - URGENCY_ORDER.index(t)) <= 1 for p, t in zip(pred, y_test)])),
            4,
        )

    return {
        "pipeline": search.best_estimator_,
        "lexicon": {**macro_scores(y_test, lexicon_pred), "within_one_level": within_one(lexicon_pred)},
        "supervised": {
            **macro_scores(y_test, supervised_pred),
            "within_one_level": within_one(supervised_pred),
            "best_params": {"C": search.best_params_["clf__C"]},
        },
        "mcnemar_supervised_vs_lexicon": mcnemar(y_test, supervised_pred, lexicon_pred),
        "lexicon_confusion_matrix": confusion_matrix(y_test, lexicon_pred, labels=URGENCY_ORDER).tolist(),
        "supervised_confusion_matrix": confusion_matrix(y_test, supervised_pred, labels=URGENCY_ORDER).tolist(),
    }


# --------------------------------------------------------------------------- 6 topics
def npmi_coherence(doc_term, top_indices: list[np.ndarray]) -> float:
    """Average NPMI over word pairs using document co-occurrence (Bouma, 2009)."""
    binary = (doc_term > 0).astype(np.float64).tocsc()
    n_docs = binary.shape[0]
    scores = []
    for indices in top_indices:
        for i_pos, i in enumerate(indices):
            for j in indices[i_pos + 1:]:
                p_i = binary[:, i].sum() / n_docs
                p_j = binary[:, j].sum() / n_docs
                p_ij = binary[:, i].multiply(binary[:, j]).sum() / n_docs
                if p_ij == 0:
                    scores.append(-1.0)
                    continue
                pmi = math.log(p_ij / (p_i * p_j))
                scores.append(pmi / -math.log(p_ij))
    return float(np.mean(scores))


def train_topics(rows, seed: int, k_values=range(8, 21, 2)) -> dict[str, object]:
    # k starts at 8 (above the 7 routing categories): topics are meant to expose
    # finer-grained root causes than the categories already provide. The upper
    # bound of 20 keeps the theme list reviewable by administrators (cognitive
    # load), since NPMI tends to keep rising with k on short texts.
    texts = [row["text"] for row in rows]
    vectorizer = CountVectorizer(
        token_pattern=r"(?u)\b[a-z][a-z]{2,}\b",
        stop_words=TOPIC_STOP_WORDS,
        min_df=5,
        max_df=0.3,
    )
    doc_term = vectorizer.fit_transform(texts)
    vocab = np.array(vectorizer.get_feature_names_out())

    coherence_table = []
    models = {}
    for k in k_values:
        lda = LatentDirichletAllocation(
            n_components=k, learning_method="batch", max_iter=20, random_state=seed
        )
        lda.fit(doc_term)
        top = [np.argsort(component)[::-1][:10] for component in lda.components_]
        coherence = npmi_coherence(doc_term, top)
        coherence_table.append(
            {"k": k, "npmi": round(coherence, 4), "perplexity": round(float(lda.perplexity(doc_term)), 2)}
        )
        models[k] = lda

    best_k = max(coherence_table, key=lambda row: row["npmi"])["k"]
    lda = models[best_k]
    doc_topic = lda.transform(doc_term)
    dominant = doc_topic.argmax(axis=1)

    topics = []
    for topic_id, component in enumerate(lda.components_):
        order = np.argsort(component)[::-1][:10]
        members = [rows[i] for i in np.where(dominant == topic_id)[0]]
        category_mix = Counter(row["true_category"] for row in members)
        topics.append(
            {
                "topic_id": topic_id,
                "top_words": vocab[order].tolist(),
                "documents": len(members),
                "share": round(len(members) / len(rows), 4),
                "dominant_category": category_mix.most_common(1)[0][0] if members else None,
                "category_purity": round(category_mix.most_common(1)[0][1] / len(members), 4) if members else 0.0,
            }
        )

    detection = detect_planted_events(rows, dominant, best_k)
    return {
        "vectorizer": vectorizer,
        "lda": lda,
        "best_k": best_k,
        "coherence_table": coherence_table,
        "topics": topics,
        "detection": detection,
        "dominant": dominant,
    }


def detect_planted_events(rows, dominant: np.ndarray, k: int, z: float = 3.0, min_count: int = 5):
    """Weekly spike detector: alert when a topic's weekly volume exceeds the
    mean + z*std of the previous 8 weeks (and at least ``min_count``)."""
    week_of = [
        (datetime.fromisoformat(row["created_at"]).date() - START_DATE).days // 7 for row in rows
    ]
    n_weeks = max(week_of) + 1
    counts = np.zeros((k, n_weeks), dtype=int)
    for topic, week in zip(dominant, week_of):
        counts[topic, week] += 1

    alerts = []
    for topic in range(k):
        for week in range(8, n_weeks):
            history = counts[topic, week - 8:week]
            threshold = history.mean() + z * max(history.std(), 1.0)
            if counts[topic, week] >= max(min_count, threshold):
                alerts.append({"topic_id": topic, "week": week, "count": int(counts[topic, week]),
                               "threshold": round(float(threshold), 2)})

    events = []
    matched_alerts = set()
    for event in PLANTED_EVENTS:
        start_week = event.start_offset_days // 7
        end_week = (event.start_offset_days + event.duration_days) // 7
        event_topics = Counter(
            int(topic) for topic, row in zip(dominant, rows) if row["event_tag"] == event.tag
        )
        main_topic, main_count = event_topics.most_common(1)[0]
        hits = [a for a in alerts if a["topic_id"] == main_topic and start_week <= a["week"] <= end_week]
        for alert in hits:
            matched_alerts.add((alert["topic_id"], alert["week"]))
        first = min((a["week"] for a in hits), default=None)
        events.append(
            {
                "event": event.tag,
                "event_start": (START_DATE + timedelta(days=event.start_offset_days)).isoformat(),
                "planted_documents": event.count,
                "captured_by_topic": main_topic,
                "topic_capture_rate": round(main_count / event.count, 4),
                "detected": first is not None,
                "detection_delay_days": (
                    max(0, first * 7 - event.start_offset_days) if first is not None else None
                ),
            }
        )

    unmatched = [a for a in alerts if (a["topic_id"], a["week"]) not in matched_alerts]
    return {
        "method": f"weekly count > mean + {z}*std of previous 8 weeks (min {min_count})",
        "events": events,
        "detected_events": sum(1 for e in events if e["detected"]),
        "total_alerts": len(alerts),
        "alerts_outside_events": len(unmatched),
        "weekly_counts": counts.tolist(),
        "alerts": alerts,
    }


# --------------------------------------------------------------------------- figures
def write_figures(out_dir: Path, rows, cls: dict, urgency: dict, topics: dict) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    out_dir.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.family": "serif", "font.size": 10, "figure.dpi": 150})
    labels = cls["labels"]

    def save(fig, name):
        fig.tight_layout()
        fig.savefig(out_dir / name, bbox_inches="tight")
        plt.close(fig)

    # Class distribution.
    fig, ax = plt.subplots(figsize=(6, 3.2))
    counts = Counter(row["true_category"] for row in rows)
    ordered = sorted(counts, key=counts.get, reverse=True)
    ax.bar(ordered, [counts[c] for c in ordered], color="#2f6f9f")
    ax.set_ylabel("Grievances")
    ax.set_title("Category distribution of the synthetic dataset (n = %d)" % len(rows))
    for i, c in enumerate(ordered):
        ax.text(i, counts[c] + 10, str(counts[c]), ha="center", fontsize=8)
    save(fig, "fig_dataset_class_distribution.png")

    # Monthly volume by category.
    months = sorted({row["created_at"][:7] for row in rows})
    by_cat = {c: [0] * len(months) for c in labels}
    for row in rows:
        by_cat[row["true_category"]][months.index(row["created_at"][:7])] += 1
    fig, ax = plt.subplots(figsize=(8, 3.6))
    bottom = np.zeros(len(months))
    palette = plt.get_cmap("tab10")
    for i, c in enumerate(labels):
        ax.bar(months, by_cat[c], bottom=bottom, label=c, color=palette(i))
        bottom += np.array(by_cat[c])
    ax.set_ylabel("Grievances per month")
    ax.set_title("Monthly grievance volume by category")
    ax.tick_params(axis="x", rotation=60, labelsize=7)
    ax.legend(ncol=4, fontsize=7, frameon=False)
    save(fig, "fig_dataset_monthly_volume.png")

    # Model comparison.
    names = list(cls["results"])
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    x = np.arange(len(names))
    for offset, metric in ((-0.2, "accuracy"), (0.0, "macro_f1"), (0.2, "macro_precision")):
        ax.bar(x + offset, [cls["results"][n]["test"][metric] for n in names], width=0.2,
               label=metric.replace("_", " "))
    ax.axhline(cls["student_self_selection"]["accuracy"], color="grey", linestyle="--", linewidth=1,
               label="student self-selection (accuracy)")
    ax.set_xticks(x, names, fontsize=8)
    ax.set_ylim(0.5, 1.0)
    ax.set_title("Test-set performance of category classifiers")
    ax.legend(fontsize=7, frameon=False, loc="lower right")
    save(fig, "fig_model_comparison.png")

    # Confusion matrices.
    for key, title, name in (
        ("test_confusion_matrix", f"{cls['best_model']} (test set)", "fig_confusion_best.png"),
        ("baseline_confusion_matrix", "Centroid baseline (test set)", "fig_confusion_baseline.png"),
    ):
        matrix = np.array(cls[key])
        fig, ax = plt.subplots(figsize=(4.8, 4.2))
        ax.imshow(matrix, cmap="Blues")
        ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right", fontsize=8)
        ax.set_yticks(range(len(labels)), labels, fontsize=8)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("True")
        for i in range(len(labels)):
            for j in range(len(labels)):
                ax.text(j, i, matrix[i, j], ha="center", va="center", fontsize=7,
                        color="white" if matrix[i, j] > matrix.max() / 2 else "black")
        ax.set_title(title, fontsize=9)
        save(fig, name)

    # Threshold trade-off.
    table = cls["threshold_table"]
    fig, ax = plt.subplots(figsize=(5.5, 3.2))
    ax.plot([r["threshold"] for r in table], [r["coverage"] for r in table], marker="o", label="coverage (auto-routed)")
    ax.plot([r["threshold"] for r in table], [r["accuracy"] for r in table], marker="s", label="accuracy of auto-routed")
    ax.axvline(cls["auto_route_threshold"], color="grey", linestyle="--", linewidth=1)
    ax.set_xlabel("Confidence threshold")
    ax.set_title("Auto-routing threshold trade-off")
    ax.legend(fontsize=8, frameon=False)
    save(fig, "fig_threshold_tradeoff.png")

    # Urgency confusion (supervised).
    matrix = np.array(urgency["supervised_confusion_matrix"])
    fig, ax = plt.subplots(figsize=(4, 3.5))
    ax.imshow(matrix, cmap="Oranges")
    ax.set_xticks(range(4), URGENCY_ORDER)
    ax.set_yticks(range(4), URGENCY_ORDER)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Expected")
    for i in range(4):
        for j in range(4):
            ax.text(j, i, matrix[i, j], ha="center", va="center", fontsize=8)
    ax.set_title("Supervised urgency model (test set)", fontsize=9)
    save(fig, "fig_urgency_confusion.png")

    # LDA coherence.
    table = topics["coherence_table"]
    fig, ax = plt.subplots(figsize=(5, 3))
    ax.plot([r["k"] for r in table], [r["npmi"] for r in table], marker="o")
    ax.axvline(topics["best_k"], color="grey", linestyle="--", linewidth=1)
    ax.set_xlabel("Number of topics (k)")
    ax.set_ylabel("Mean NPMI coherence")
    ax.set_title("LDA model selection")
    save(fig, "fig_lda_coherence.png")

    # Weekly topic trend with planted events.
    weekly = np.array(topics["detection"]["weekly_counts"])
    fig, ax = plt.subplots(figsize=(8, 3.6))
    for event in topics["detection"]["events"]:
        planted = next(e for e in PLANTED_EVENTS if e.tag == event["event"])
        start = planted.start_offset_days / 7
        ax.axvspan(start, start + planted.duration_days / 7, color="#f4c2c2", alpha=0.5)
        ax.plot(np.arange(weekly.shape[1]), weekly[event["captured_by_topic"]],
                label=f"topic {event['captured_by_topic']} ({event['event'].replace('_', ' ')})")
    for alert in topics["detection"]["alerts"]:
        ax.plot(alert["week"], alert["count"], "kx", markersize=5)
    ax.set_xlabel(f"Week since {START_DATE.isoformat()}")
    ax.set_ylabel("Grievances per week")
    ax.set_title("Weekly topic volume; shaded = planted issue windows, x = spike alerts")
    ax.legend(fontsize=7, frameon=False)
    save(fig, "fig_topic_spikes.png")


# --------------------------------------------------------------------------- main
def run(seed: int, figures_dir: Path | None) -> dict[str, object]:
    rows = load_dataset()
    train_rows, test_rows = train_test_split(
        rows, test_size=0.2, random_state=seed, stratify=[row["true_category"] for row in rows]
    )

    cls = train_classifiers(train_rows, test_rows, seed)
    faithfulness = shap_faithfulness(
        cls["pipeline"], [r["text"] for r in train_rows], [r["text"] for r in test_rows], seed
    )
    urgency = train_urgency(train_rows, test_rows, seed)
    topics = train_topics(rows, seed)

    sentiment = SentimentAnalyzer()
    sentiment_labels = Counter(
        sentiment.analyze(f"{row['title']}. {row['description']}").label for row in rows
    )

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "pipeline": cls["pipeline"],
            "model_name": cls["best_model"],
            "labels": cls["labels"],
            "background": faithfulness["background"],
            "auto_route_threshold": cls["auto_route_threshold"],
        },
        ARTIFACT_DIR / "classifier.joblib",
        compress=3,
    )
    joblib.dump({"pipeline": urgency["pipeline"], "labels": URGENCY_ORDER}, ARTIFACT_DIR / "urgency.joblib", compress=3)
    joblib.dump(
        {"vectorizer": topics["vectorizer"], "lda": topics["lda"], "topics": topics["topics"]},
        ARTIFACT_DIR / "topics.joblib",
        compress=3,
    )

    metrics = {
        "generated_at": date.today().isoformat(),
        "seed": seed,
        "dataset": {
            "documents": len(rows),
            "train": len(train_rows),
            "test": len(test_rows),
            "class_counts": dict(Counter(row["true_category"] for row in rows)),
            "urgency_counts": dict(Counter(row["expected_urgency"] for row in rows)),
            "ambiguous_documents": sum(1 for row in rows if row["is_ambiguous"] == "1"),
            "planted_event_documents": sum(1 for row in rows if row["event_tag"]),
        },
        "classification": {
            "labels": cls["labels"],
            "models": cls["results"],
            "best_model": cls["best_model"],
            "selection_note": cls["selection_note"],
            "per_class": cls["per_class"],
            "confusion_matrix": cls["test_confusion_matrix"],
            "baseline_confusion_matrix": cls["baseline_confusion_matrix"],
            "student_self_selection": cls["student_self_selection"],
            "mcnemar_best_vs_baseline": cls["mcnemar_best_vs_baseline"],
            "mcnemar_best_vs_uniform_centroid": cls["mcnemar_best_vs_uniform_centroid"],
            "mcnemar_best_vs_student": cls["mcnemar_best_vs_student"],
            "ambiguous_test_accuracy": cls["ambiguous_test_accuracy"],
            "threshold_table": cls["threshold_table"],
            "auto_route_threshold": cls["auto_route_threshold"],
            "auto_route_at_threshold": cls["auto_route_at_threshold"],
        },
        "explainability": {key: value for key, value in faithfulness.items() if key != "background"},
        "urgency": {key: value for key, value in urgency.items() if key != "pipeline"},
        "sentiment_distribution": dict(sentiment_labels),
        "topics": {
            "best_k": topics["best_k"],
            "coherence_table": topics["coherence_table"],
            "topics": topics["topics"],
            "detection": {key: value for key, value in topics["detection"].items() if key != "weekly_counts"},
        },
    }
    (ARTIFACT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    if figures_dir is not None:
        write_figures(figures_dir, rows, cls, urgency, topics)
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--figures", type=Path, default=None, help="Directory for thesis figures")
    parser.add_argument("--if-missing", action="store_true", help="Skip if artifacts already exist")
    args = parser.parse_args()

    if args.if_missing and (ARTIFACT_DIR / "classifier.joblib").exists():
        print("Artifacts already present; skipping training.")
        return

    metrics = run(args.seed, args.figures)
    cls = metrics["classification"]
    print(f"Best model: {cls['best_model']} - {cls['selection_note']}")
    for name, result in cls["models"].items():
        print(f"  {name:28s} CV F1 {result['cv_macro_f1_mean']:.4f}  test {result['test']}")
    print(f"Student self-selection: {cls['student_self_selection']}")
    print(f"Auto-route threshold: {cls['auto_route_threshold']} -> {cls['auto_route_at_threshold']}")
    print(f"Explainability: {metrics['explainability']}")
    print(f"Urgency lexicon: {metrics['urgency']['lexicon']}")
    print(f"Urgency supervised: {metrics['urgency']['supervised']}")
    print(f"LDA k={metrics['topics']['best_k']}; events: {metrics['topics']['detection']['events']}")
    print(f"Alerts outside events: {metrics['topics']['detection']['alerts_outside_events']}")


if __name__ == "__main__":
    main()
