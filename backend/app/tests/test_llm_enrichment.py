from app.core.config import get_settings
from app.services.llm_enrichment_service import LLMEnrichmentService


class BrokenProvider:
    def summarize(self, text: str) -> str:
        _ = text
        raise RuntimeError("summary failed")

    def extract_entities(self, text: str) -> dict:
        _ = text
        raise RuntimeError("entity extraction failed")


def test_llm_enrichment_returns_noop_when_disabled(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    get_settings.cache_clear()

    service = LLMEnrichmentService()
    summary, entities = service.enrich_text(
        "Student portal is unavailable during registration period"
    )

    assert service.provider_name == "none"
    assert "Student portal" in summary
    assert entities == {}


def test_llm_enrichment_returns_noop_when_groq_key_missing(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "")
    get_settings.cache_clear()

    service = LLMEnrichmentService()
    summary, entities = service.enrich_text("Payment receipt is still unavailable")

    assert service.provider_name == "none"
    assert summary
    assert entities == {}


def test_llm_enrichment_fallback_when_provider_raises():
    service = LLMEnrichmentService()
    service.provider = BrokenProvider()

    summary = service.summarize("Urgent network failure in exam hall")
    entities = service.extract_entities("Urgent network failure in exam hall")

    assert "Urgent network failure" in summary
    assert entities == {}
