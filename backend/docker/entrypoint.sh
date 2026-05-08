#!/bin/sh
set -eu

python -m app.scripts.wait_for_db
python -m alembic -c alembic.ini upgrade head
python -m app.scripts.bootstrap_demo_data

exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
