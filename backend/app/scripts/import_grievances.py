from __future__ import annotations

import argparse
import csv
import getpass
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

TITLE_MIN_LENGTH = 3
TITLE_MAX_LENGTH = 200
DESCRIPTION_MIN_LENGTH = 10
DESCRIPTION_MAX_LENGTH = 6000
CATEGORY_MIN_LENGTH = 2
CATEGORY_MAX_LENGTH = 64

TRUTHY_VALUES = {"1", "true", "yes", "y", "t"}
FALSY_VALUES = {"0", "false", "no", "n", ""}


class ImportErrorWithContext(Exception):
    pass


@dataclass(frozen=True)
class GrievancePayload:
    title: str
    description: str
    category: str
    is_anonymous: bool
    source_line: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Bulk import grievance records from CSV using live API endpoints."
        )
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to CSV data file.",
    )
    parser.add_argument(
        "--api-base-url",
        default="http://127.0.0.1:8000",
        help="Backend API base URL.",
    )
    parser.add_argument(
        "--email",
        help="Existing user email to authenticate import requests.",
    )
    parser.add_argument(
        "--password",
        help="Existing user password. Omit to prompt securely.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=20.0,
        help="HTTP request timeout in seconds.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="Optional max rows to import (0 means all).",
    )
    parser.add_argument(
        "--skip-invalid",
        action="store_true",
        help="Skip invalid rows and continue import.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate file and show summary without sending API requests.",
    )
    return parser.parse_args()

def parse_boolean(raw_value: Any, source_line: int) -> bool:
    if isinstance(raw_value, bool):
        return raw_value
    if raw_value is None:
        return False

    normalized = str(raw_value).strip().lower()
    if normalized in TRUTHY_VALUES:
        return True
    if normalized in FALSY_VALUES:
        return False
    raise ImportErrorWithContext(
        f"Line {source_line}: invalid boolean value '{raw_value}' for is_anonymous."
    )


def normalize_payload(raw: dict[str, Any], source_line: int) -> GrievancePayload:
    title = str(raw.get("title", "")).strip()
    description = str(raw.get("description", "")).strip()
    category = str(raw.get("category", "")).strip().lower()
    is_anonymous = parse_boolean(raw.get("is_anonymous", False), source_line)

    if not (TITLE_MIN_LENGTH <= len(title) <= TITLE_MAX_LENGTH):
        raise ImportErrorWithContext(
            f"Line {source_line}: title length must be {TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH}."
        )
    if not (DESCRIPTION_MIN_LENGTH <= len(description) <= DESCRIPTION_MAX_LENGTH):
        raise ImportErrorWithContext(
            "Line "
            f"{source_line}: description length must be "
            f"{DESCRIPTION_MIN_LENGTH}-{DESCRIPTION_MAX_LENGTH}."
        )
    if not (CATEGORY_MIN_LENGTH <= len(category) <= CATEGORY_MAX_LENGTH):
        raise ImportErrorWithContext(
            f"Line {source_line}: category length must be {CATEGORY_MIN_LENGTH}-{CATEGORY_MAX_LENGTH}."
        )

    return GrievancePayload(
        title=title,
        description=description,
        category=category,
        is_anonymous=is_anonymous,
        source_line=source_line,
    )


def load_from_csv(path: Path, skip_invalid: bool) -> tuple[list[GrievancePayload], list[str]]:
    rows: list[GrievancePayload] = []
    errors: list[str] = []

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required_columns = {"title", "description", "category"}
        available_columns = set(reader.fieldnames or [])
        missing = sorted(required_columns - available_columns)
        if missing:
            raise ImportErrorWithContext(
                f"CSV is missing required columns: {', '.join(missing)}"
            )

        for index, raw_row in enumerate(reader, start=2):
            try:
                rows.append(normalize_payload(raw_row, index))
            except ImportErrorWithContext as exc:
                if skip_invalid:
                    errors.append(str(exc))
                    continue
                raise

    return rows, errors

def resolve_credentials(args: argparse.Namespace) -> tuple[str, str]:
    email = (args.email or "").strip().lower()
    if not email:
        email = input("Import user email: ").strip().lower()
    if not email:
        raise ImportErrorWithContext("Email is required.")

    password = args.password
    if not password:
        password = getpass.getpass("Import user password: ")
    if not password:
        raise ImportErrorWithContext("Password is required.")

    return email, password


def extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip() or f"HTTP {response.status_code}"
    detail = payload.get("detail")
    if isinstance(detail, str):
        return detail
    return str(payload)


def login(client: httpx.Client, email: str, password: str) -> str:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    if response.status_code != 200:
        detail = extract_error_detail(response)
        raise ImportErrorWithContext(
            f"Authentication failed ({response.status_code}): {detail}"
        )
    payload = response.json()
    token = payload.get("access_token")
    if not isinstance(token, str) or not token:
        raise ImportErrorWithContext("Authentication response did not include access_token.")
    return token


def import_grievances(
    client: httpx.Client,
    token: str,
    payloads: list[GrievancePayload],
) -> tuple[int, list[str]]:
    success_count = 0
    errors: list[str] = []
    headers = {"Authorization": f"Bearer {token}"}

    for payload in payloads:
        response = client.post(
            "/grievances",
            headers=headers,
            json={
                "title": payload.title,
                "description": payload.description,
                "category": payload.category,
                "is_anonymous": payload.is_anonymous,
            },
        )
        if response.status_code == 201:
            success_count += 1
            continue
        detail = extract_error_detail(response)
        errors.append(
            f"Line {payload.source_line}: import failed ({response.status_code}) - {detail}"
        )

    return success_count, errors


def summarize_payloads(payloads: list[GrievancePayload]) -> str:
    category_counts = Counter(item.category for item in payloads)
    parts = [f"{category}:{count}" for category, count in sorted(category_counts.items())]
    categories_text = ", ".join(parts) if parts else "none"
    return f"rows={len(payloads)} categories=[{categories_text}]"


def main() -> None:
    args = parse_args()
    path = Path(args.file).resolve()
    if not path.exists():
        raise SystemExit(f"Input file not found: {path}")
    if path.suffix.lower() != ".csv":
        raise SystemExit("CSV input is required. Please provide a .csv file.")

    try:
        payloads, parse_errors = load_from_csv(path, args.skip_invalid)
    except ImportErrorWithContext as exc:
        raise SystemExit(str(exc)) from exc

    if args.max_rows and args.max_rows > 0:
        payloads = payloads[: args.max_rows]

    print(f"Loaded {summarize_payloads(payloads)} from {path}")

    if parse_errors:
        print(f"Skipped {len(parse_errors)} invalid row(s):")
        for message in parse_errors:
            print(f"- {message}")

    if not payloads:
        raise SystemExit("No valid rows to import.")

    if args.dry_run:
        print("Dry run complete. No API requests were sent.")
        return

    try:
        email, password = resolve_credentials(args)
        with httpx.Client(
            base_url=args.api_base_url.rstrip("/"),
            timeout=args.timeout_seconds,
        ) as client:
            token = login(client, email, password)
            success_count, import_errors = import_grievances(client, token, payloads)
    except ImportErrorWithContext as exc:
        raise SystemExit(str(exc)) from exc
    except httpx.HTTPError as exc:
        raise SystemExit(f"HTTP error during import: {exc}") from exc

    print(f"Imported {success_count}/{len(payloads)} grievance(s).")
    if import_errors:
        print(f"Failed rows: {len(import_errors)}")
        for message in import_errors:
            print(f"- {message}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
