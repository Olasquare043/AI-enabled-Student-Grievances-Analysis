from __future__ import annotations

import hashlib
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Sequence

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


@dataclass(slots=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_after_seconds: int
    retry_after_seconds: int | None = None


class RateLimiter:
    def __init__(
        self,
        *,
        max_requests: int,
        window_seconds: int,
        enabled: bool = True,
    ) -> None:
        self._lock = threading.Lock()
        self.max_requests = max(1, max_requests)
        self.window_seconds = max(1, window_seconds)
        self.enabled = enabled
        self._buckets: dict[str, deque[float]] = {}

    def configure(
        self,
        *,
        enabled: bool | None = None,
        max_requests: int | None = None,
        window_seconds: int | None = None,
    ) -> None:
        with self._lock:
            if enabled is not None:
                self.enabled = enabled
            if max_requests is not None:
                self.max_requests = max(1, max_requests)
            if window_seconds is not None:
                self.window_seconds = max(1, window_seconds)

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def evaluate(self, key: str) -> RateLimitDecision:
        now = time.time()

        with self._lock:
            if not self.enabled:
                return RateLimitDecision(
                    allowed=True,
                    limit=self.max_requests,
                    remaining=self.max_requests,
                    reset_after_seconds=self.window_seconds,
                )

            bucket = self._buckets.setdefault(key, deque())
            cutoff = now - self.window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                reset_after = max(1, int(self.window_seconds - (now - bucket[0])))
                return RateLimitDecision(
                    allowed=False,
                    limit=self.max_requests,
                    remaining=0,
                    reset_after_seconds=reset_after,
                    retry_after_seconds=reset_after,
                )

            bucket.append(now)
            remaining = max(0, self.max_requests - len(bucket))
            reset_after = max(1, int(self.window_seconds - (now - bucket[0])))
            return RateLimitDecision(
                allowed=True,
                limit=self.max_requests,
                remaining=remaining,
                reset_after_seconds=reset_after,
            )


def _token_fingerprint(token: str) -> str:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return digest[:16]


def _resolve_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _rate_limit_key(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            return f"token:{_token_fingerprint(token)}"

    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return f"token:{_token_fingerprint(cookie_token)}"

    return f"ip:{_resolve_client_ip(request)}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        rate_limiter: RateLimiter,
        exempt_paths: Sequence[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.rate_limiter = rate_limiter
        self.exempt_paths = tuple(exempt_paths or ())

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.exempt_paths)

    @staticmethod
    def _apply_headers(response: Response, decision: RateLimitDecision) -> None:
        response.headers["X-RateLimit-Limit"] = str(decision.limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        response.headers["X-RateLimit-Reset"] = str(decision.reset_after_seconds)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() == "OPTIONS" or self._is_exempt(request.url.path):
            return await call_next(request)

        decision = self.rate_limiter.evaluate(_rate_limit_key(request))
        if not decision.allowed:
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after_seconds": decision.retry_after_seconds,
                },
            )
            if decision.retry_after_seconds is not None:
                response.headers["Retry-After"] = str(decision.retry_after_seconds)
            self._apply_headers(response, decision)
            return response

        response = await call_next(request)
        self._apply_headers(response, decision)
        return response
