from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id_ctx.get()


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = int(round((len(sorted_values) - 1) * percentile))
    index = max(0, min(index, len(sorted_values) - 1))
    return sorted_values[index]


@dataclass(slots=True)
class RouteSummary:
    route: str
    requests: int
    avg_latency_ms: float
    p95_latency_ms: float


class MonitoringState:
    def __init__(self, *, max_samples: int = 2000) -> None:
        self.max_samples = max(100, max_samples)
        self._lock = threading.Lock()
        self._started_at = time.time()
        self._total_requests = 0
        self._client_errors = 0
        self._server_errors = 0
        self._status_counts: dict[str, int] = defaultdict(int)
        self._route_counts: dict[str, int] = defaultdict(int)
        self._durations: deque[float] = deque(maxlen=self.max_samples)
        self._route_durations: dict[str, deque[float]] = defaultdict(
            lambda: deque(maxlen=200)
        )

    def record(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        route_key = f"{method.upper()} {path}"
        with self._lock:
            self._total_requests += 1
            if 400 <= status_code < 500:
                self._client_errors += 1
            elif status_code >= 500:
                self._server_errors += 1

            self._status_counts[str(status_code)] += 1
            self._route_counts[route_key] += 1
            self._durations.append(duration_ms)
            self._route_durations[route_key].append(duration_ms)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            total_requests = self._total_requests
            client_errors = self._client_errors
            server_errors = self._server_errors
            status_counts = dict(self._status_counts)
            route_counts = dict(self._route_counts)
            durations = list(self._durations)
            route_durations = {key: list(values) for key, values in self._route_durations.items()}

        avg_latency_ms = round(sum(durations) / len(durations), 2) if durations else 0.0
        p95_latency_ms = round(_percentile(durations, 0.95), 2) if durations else 0.0
        error_rate = (
            round(((client_errors + server_errors) / total_requests) * 100.0, 2)
            if total_requests > 0
            else 0.0
        )

        top_routes: list[RouteSummary] = []
        for route, requests in sorted(
            route_counts.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:10]:
            samples = route_durations.get(route, [])
            avg_route = round(sum(samples) / len(samples), 2) if samples else 0.0
            p95_route = round(_percentile(samples, 0.95), 2) if samples else 0.0
            top_routes.append(
                RouteSummary(
                    route=route,
                    requests=requests,
                    avg_latency_ms=avg_route,
                    p95_latency_ms=p95_route,
                )
            )

        return {
            "uptime_seconds": int(time.time() - self._started_at),
            "total_requests": total_requests,
            "client_errors": client_errors,
            "server_errors": server_errors,
            "error_rate_percent": error_rate,
            "avg_latency_ms": avg_latency_ms,
            "p95_latency_ms": p95_latency_ms,
            "status_counts": status_counts,
            "top_routes": [
                {
                    "route": item.route,
                    "requests": item.requests,
                    "avg_latency_ms": item.avg_latency_ms,
                    "p95_latency_ms": item.p95_latency_ms,
                }
                for item in top_routes
            ],
        }


class RequestMonitoringMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        monitoring_state: MonitoringState,
        enabled: bool = True,
    ) -> None:
        super().__init__(app)
        self.monitoring_state = monitoring_state
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = uuid.uuid4().hex

        token = _request_id_ctx.set(request_id)
        started_at = time.perf_counter()
        method = request.method
        path = request.url.path
        client_host = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            duration_ms = (time.perf_counter() - started_at) * 1000.0
            if self.enabled:
                self.monitoring_state.record(
                    method=method,
                    path=path,
                    status_code=500,
                    duration_ms=duration_ms,
                )
            logger.exception(
                "http_request_failed method=%s path=%s client=%s duration_ms=%.2f request_id=%s",
                method,
                path,
                client_host,
                duration_ms,
                request_id,
            )
            raise
        finally:
            _request_id_ctx.reset(token)

        duration_ms = (time.perf_counter() - started_at) * 1000.0
        if self.enabled:
            self.monitoring_state.record(
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
            )

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

        logger.info(
            "http_request method=%s path=%s status=%s client=%s duration_ms=%.2f request_id=%s",
            method,
            path,
            status_code,
            client_host,
            duration_ms,
            request_id,
        )
        return response
