"""Shared text preprocessing for the ML pipeline (training and runtime)."""

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# Tokens must start with a letter, so long numeric references (RRR numbers,
# amounts) are dropped while course codes such as "csc301" are kept.
TOKEN_PATTERN = r"(?u)\b[a-z][a-z0-9]+\b"

# Courtesy and filler words that carry no information about the complaint.
DOMAIN_STOP_WORDS = frozenset(
    {
        "abeg", "also", "appreciate", "dear", "day", "good", "afternoon", "morning",
        "help", "kindly", "ma", "matter", "need", "please", "sir", "thank", "thanks",
        "una", "make", "dey", "don", "wey", "writing", "complain", "complaint", "issue",
        "look", "quick", "response", "treat", "priority", "times", "already", "reported",
        "nothing", "done", "second", "same", "am", "im",
    }
)

STOP_WORDS = sorted(ENGLISH_STOP_WORDS | DOMAIN_STOP_WORDS)


def build_text(title: str | None, description: str | None) -> str:
    """Combine title and description into the single document the models see."""
    return f"{(title or '').strip()}. {(description or '').strip()}".strip(". ").lower()


# Extra filler words removed only for topic modelling: they are frequent in
# complaint narratives but describe the complaining, not the problem.
TOPIC_STOP_WORDS = sorted(
    set(STOP_WORDS)
    | {
        "student", "students", "come", "keeps", "office", "offices", "ago", "time", "shows",
        "school", "working", "week", "weeks", "days", "told", "going", "tired", "sending",
        "waiting", "still", "nobody", "attending", "frustrating", "went", "got", "asked",
        "said", "saying", "like", "just", "new", "able", "way", "back", "forth", "problem",
        "solved",
    }
)
