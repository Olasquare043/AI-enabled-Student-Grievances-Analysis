from app.core.config import Settings, get_settings
from app.llm.base import LLMProvider, NoOpLLMProvider
from app.llm.groq_provider import GroqLLMProvider

DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    runtime_settings = settings or get_settings()
    if runtime_settings.llm_provider == "groq" and runtime_settings.groq_api_key:
        model = runtime_settings.groq_model or DEFAULT_GROQ_MODEL
        return GroqLLMProvider(api_key=runtime_settings.groq_api_key, model=model)
    return NoOpLLMProvider()

