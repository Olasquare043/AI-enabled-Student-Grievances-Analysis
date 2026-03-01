import json
from typing import Any

import httpx

from app.llm.base import LLMProvider
from app.llm.prompts import ENTITY_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT


class GroqLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str, timeout: float = 30.0) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def _chat_completion(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()

        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("Groq response did not include choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str):
            raise RuntimeError("Groq response content is invalid")
        return content.strip()

    def summarize(self, text: str) -> str:
        return self._chat_completion(SUMMARY_SYSTEM_PROMPT, text)

    def extract_entities(self, text: str) -> dict:
        content = self._chat_completion(ENTITY_SYSTEM_PROMPT, text)
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        return {"raw": content}

