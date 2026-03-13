import sys
from typing import NoReturn

from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.services.user_service import normalize_all_user_roles, seed_roles


def abort(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    with SessionLocal() as db:
        try:
            seed_roles(db)
            normalized_count = normalize_all_user_roles(db)
            print(f"Role normalization complete. Users updated: {normalized_count}")
        except SQLAlchemyError as exc:
            db.rollback()
            abort(f"Failed to normalize user roles: {exc}")


if __name__ == "__main__":
    main()
