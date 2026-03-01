from app.core.config import get_settings
from app.llm.base import NoOpLLMProvider
from app.llm.factory import get_llm_provider


def test_llm_factory_returns_noop_when_disabled(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    get_settings.cache_clear()

    provider = get_llm_provider()
    assert isinstance(provider, NoOpLLMProvider)
    assert provider.extract_entities("Text") == {}


def test_llm_factory_returns_noop_without_groq_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "")
    get_settings.cache_clear()

    provider = get_llm_provider()
    assert isinstance(provider, NoOpLLMProvider)
    summary = provider.summarize("One two three")
    assert summary == "One two three"
