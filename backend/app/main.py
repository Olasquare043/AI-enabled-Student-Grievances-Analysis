import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.monitoring import MonitoringState, RequestMonitoringMiddleware
from app.db import base as _base_models  # noqa: F401
from app.db.session import SessionLocal
from app.middleware.rate_limit import RateLimitMiddleware, RateLimiter
from app.services.escalation_service import seed_default_escalation_rules
from app.services.routing_service import seed_departments
from app.services.sla_service import seed_default_sla_policies
from app.services.user_service import seed_roles

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    with SessionLocal() as db:
        seed_roles(db)
        seed_departments(db)
        seed_default_sla_policies(db)
        seed_default_escalation_rules(db)
    logger.info("application_startup_complete")
    yield
    logger.info("application_shutdown_complete")


settings = get_settings()
app = FastAPI(
    title="AI-enabled Student Grievances Analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

monitoring_state = MonitoringState(max_samples=settings.monitoring_max_samples)
rate_limiter = RateLimiter(
    max_requests=settings.rate_limit_max_requests,
    window_seconds=settings.rate_limit_window_seconds,
    enabled=settings.rate_limit_enabled,
)
app.state.monitoring_state = monitoring_state
app.state.rate_limiter = rate_limiter

app.add_middleware(
    RateLimitMiddleware,
    rate_limiter=rate_limiter,
    exempt_paths=settings.rate_limit_exempt_paths,
)
app.add_middleware(
    RequestMonitoringMiddleware,
    monitoring_state=monitoring_state,
    enabled=settings.monitoring_enabled,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
