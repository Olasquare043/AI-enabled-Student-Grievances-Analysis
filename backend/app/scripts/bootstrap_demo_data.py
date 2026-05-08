from __future__ import annotations

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.scripts.seed_demo_data import (
    database_has_application_data,
    print_summary,
    run_demo_seed,
)


def main() -> None:
    settings = get_settings()
    if not settings.auto_seed_demo_data:
        print("Skipping demo seed because AUTO_SEED_DEMO_DATA is disabled.")
        return

    with SessionLocal() as db:
        if database_has_application_data(db):
            print("Existing application data detected. Skipping demo seed.")
            return

    run_demo_seed(force_reset=False)
    print_summary()


if __name__ == "__main__":
    main()
