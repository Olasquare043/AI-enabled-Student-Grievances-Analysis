import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://root:olayiwola@localhost:5432/grievance_test",
)
os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://root:olayiwola@localhost:5432/grievance_test",
)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("LLM_PROVIDER", "none")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("MONITORING_ENABLED", "true")

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.escalation_service import seed_default_escalation_rules  # noqa: E402
from app.services.routing_service import seed_departments  # noqa: E402
from app.services.sla_service import seed_default_sla_policies  # noqa: E402
from app.services.user_service import seed_roles  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def prepare_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_roles(db)
        seed_departments(db)
        seed_default_sla_policies(db)
        seed_default_escalation_rules(db)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_database() -> None:
    table_names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as connection:
        connection.execute(
            text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE;")
        )
    with SessionLocal() as db:
        seed_roles(db)
        seed_departments(db)
        seed_default_sla_policies(db)
        seed_default_escalation_rules(db)
    yield


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    with SessionLocal() as db:
        yield db
