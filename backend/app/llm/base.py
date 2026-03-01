from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def summarize(self, text: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def extract_entities(self, text: str) -> dict:
        raise NotImplementedError


class NoOpLLMProvider(LLMProvider):
    def summarize(self, text: str) -> str:
        normalized = " ".join(text.split())
        if not normalized:
            return ""
        max_chars = 240
        return (
            normalized
            if len(normalized) <= max_chars
            else f"{normalized[:max_chars].rstrip()}..."
        )

    def extract_entities(self, text: str) -> dict:
        _ = text
        return {}

