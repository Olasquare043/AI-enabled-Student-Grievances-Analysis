from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
# Supabase's transaction pooler (port 6543) does not support prepared
# statements; the session pooler (5432) and local Postgres do.
_connect_args = {"prepare_threshold": None} if ":6543/" in settings.database_url else {}
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Ensure ORM models are registered before first mapper configuration.
import app.db.base  # noqa: E402,F401
