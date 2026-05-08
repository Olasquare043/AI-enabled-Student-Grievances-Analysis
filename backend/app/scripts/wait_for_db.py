from __future__ import annotations

import os
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    timeout_seconds = int(os.getenv("DB_WAIT_TIMEOUT_SECONDS", "60"))
    interval_seconds = float(os.getenv("DB_WAIT_INTERVAL_SECONDS", "2"))
    deadline = time.monotonic() + timeout_seconds
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            engine.dispose()
            print("Database connection established.")
            return
        except SQLAlchemyError as exc:
            last_error = exc
            print(f"Waiting for database: {exc}", file=sys.stderr)
            time.sleep(interval_seconds)

    engine.dispose()
    raise SystemExit(
        f"Database did not become available within {timeout_seconds} seconds: {last_error}"
    )


if __name__ == "__main__":
    main()
