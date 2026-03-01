import logging

from app.llm.base import NoOpLLMProvider
from app.llm.factory import get_llm_provider

logger = logging.getLogger(__name__)


class LLMEnrichmentService:
    def __init__(self) -> None:
        self.provider = get_llm_provider()

    @property
    def provider_name(self) -> str:
        if isinstance(self.provider, NoOpLLMProvider):
            return "none"
        return "groq"

    def summarize(self, text: str) -> str:
        cleaned = text.strip()
        if not cleaned:
            return ""

        try:
            summary = self.provider.summarize(cleaned)
            return " ".join(summary.split())
        except Exception:
            logger.exception("llm_summary_failed_fallback_to_noop")
            return NoOpLLMProvider().summarize(cleaned)

    def extract_entities(self, text: str) -> dict:
        cleaned = text.strip()
        if not cleaned:
            return {}

        try:
            entities = self.provider.extract_entities(cleaned)
            if isinstance(entities, dict):
                return entities
        except Exception:
            logger.exception("llm_entity_extraction_failed_fallback_to_noop")

        return {}

    def enrich_text(self, text: str) -> tuple[str, dict]:
        return self.summarize(text), self.extract_entities(text)
