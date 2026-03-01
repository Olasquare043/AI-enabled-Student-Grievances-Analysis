from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(..., alias="DATABASE_URL")
    test_database_url: str = Field(..., alias="TEST_DATABASE_URL")
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_access_token_expire_minutes: int = Field(
        30, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    jwt_algorithm: str = "HS256"
    llm_provider: Literal["none", "groq"] = Field("none", alias="LLM_PROVIDER")
    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str | None = Field(default=None, alias="GROQ_MODEL")
    monitoring_enabled: bool = Field(True, alias="MONITORING_ENABLED")
    monitoring_max_samples: int = Field(2000, alias="MONITORING_MAX_SAMPLES")
    rate_limit_enabled: bool = Field(True, alias="RATE_LIMIT_ENABLED")
    rate_limit_max_requests: int = Field(120, alias="RATE_LIMIT_MAX_REQUESTS")
    rate_limit_window_seconds: int = Field(60, alias="RATE_LIMIT_WINDOW_SECONDS")
    rate_limit_exempt_paths: list[str] = Field(
        default_factory=lambda: [
            "/health",
            "/openapi.json",
            "/docs",
            "/redoc",
        ],
        alias="RATE_LIMIT_EXEMPT_PATHS",
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    @field_validator("rate_limit_exempt_paths", mode="before")
    @classmethod
    def parse_rate_limit_exempt_paths(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
