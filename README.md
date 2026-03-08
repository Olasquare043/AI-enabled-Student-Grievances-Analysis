# AI-enabled Student Grievances Analysis

Production-ready monorepo foundation for:

- `backend/`: FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + JWT auth + RBAC
- `frontend/`: Next.js App Router + TypeScript + Tailwind + lucide-react + shadcn-style UI primitives

## Prerequisites

- Windows PowerShell
- Python 3.12+
- Node.js 22+ and npm
- Local PostgreSQL running on port `5432`
- PostgreSQL CLI tools (`pg_dump`, `pg_restore`, `psql`, `dropdb`, `createdb`) for backup/restore operations
- Existing databases:
  - `grievance` (dev)
  - `grievance_test` (tests)

Required connection strings (do not change):

- `DATABASE_URL=postgresql+psycopg://root:olayiwola@localhost:5432/grievance`
- `TEST_DATABASE_URL=postgresql+psycopg://root:olayiwola@localhost:5432/grievance_test`


## Environment Setup

1. Backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

2. Frontend environment file:

```powershell
Copy-Item frontend\.env.example frontend\.env.local
```

3. Ensure `backend\.env` has:

```dotenv
DATABASE_URL=postgresql+psycopg://root:olayiwola@localhost:5432/grievance
TEST_DATABASE_URL=postgresql+psycopg://root:olayiwola@localhost:5432/grievance_test
JWT_SECRET=change-this-to-a-long-random-secret
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
LLM_PROVIDER=none
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
MONITORING_ENABLED=true
MONITORING_MAX_SAMPLES=2000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_EXEMPT_PATHS=/health,/openapi.json,/docs,/redoc
```

4. Ensure `frontend\.env.local` has:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Install Dependencies

1. Backend:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

2. Frontend:

```powershell
cd frontend
npm install
cd ..
```

## Database Migrations

Run initial migration on `DATABASE_URL`:

```powershell
.\scripts\tasks.ps1 backend:migrate
```

## Bootstrap Admin User

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.scripts.create_admin
cd ..
```

The command prompts for email/password securely and is idempotent.

## Run Servers

1. Backend (`http://localhost:8000`):

```powershell
.\scripts\tasks.ps1 backend:dev
```

2. Frontend (`http://localhost:3000`):

```powershell
.\scripts\tasks.ps1 frontend:dev
```

## Run Tests And Checks

1. Backend tests (uses `TEST_DATABASE_URL`):

```powershell
.\scripts\tasks.ps1 backend:test
```

2. Frontend lint + typecheck:

```powershell
.\scripts\tasks.ps1 frontend:check
```

3. Full release smoke gate:

```powershell
.\scripts\tasks.ps1 release:smoke
```

## Bulk CSV Import (Grievances)

Use the CSV importer when you want to load many grievance records quickly through the real API.

### Browser Upload (Admin)

1. Login as an admin user.
2. Open `http://localhost:3000/imports`.
3. Download the template and upload your CSV.
4. Review imported/failed rows in the on-page result panel.

1. Start backend server:

```powershell
.\scripts\tasks.ps1 backend:dev
```

2. Prepare a CSV file using the template:

- Template path: `backend/data/grievances_import_template.csv`
- Required columns:
  - `title`
  - `description`
  - `category`
- Optional column:
  - `is_anonymous` (`true/false`, `yes/no`, `1/0`)

3. Run dry-run validation (no records created):

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.scripts.import_grievances --file data\grievances_import_template.csv --dry-run
cd ..
```

4. Run actual import:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.scripts.import_grievances --file data\grievances_import_template.csv --email your_user_email@example.com
cd ..
```

You will be prompted securely for the password if `--password` is not provided.

## Core API Endpoints

- `GET /health`
- `GET /health/metrics` (admin only)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /users/me` (authenticated user profile update)
- `GET /users` (admin only)
- `POST /users/{user_id}/roles` (admin only)
- `POST /grievances` (authenticated submitter)
- `GET /grievances` (students see own; staff/admin can use triage views)
- `GET /grievances/queue` (staff/admin triage queue)
- `GET /grievances/{grievance_id}`
- `POST /grievances/{grievance_id}/comments`
- `GET /grievances/{grievance_id}/comments`
- `PATCH /grievances/{grievance_id}/status` (staff/admin)
- `POST /grievances/{grievance_id}/assign` (staff/admin)
- `GET /operations/departments` (staff/admin)
- `POST /operations/departments` (admin)
- `PATCH /operations/departments/{department_id}` (admin)
- `GET /operations/queue` (staff/admin)
- `POST /operations/grievances/{grievance_id}/route` (staff/admin)
- `GET /operations/grievances/{grievance_id}/assignments` (staff/admin)
- `GET /operations/sla/policies` (staff/admin)
- `PUT /operations/sla/policies/{department_id}` (admin)
- `GET /operations/escalation-rules` (staff/admin)
- `POST /operations/escalation-rules` (admin)
- `POST /operations/sla/evaluate` (staff/admin)
- `GET /operations/sla/breaches` (staff/admin)
- `POST /operations/imports/grievances/csv` (admin CSV upload import)
- `GET /analytics/overview` (staff/admin analytics summary)
- `GET /analytics/topic-clusters` (staff/admin cluster insights)
- `GET /nlp/provider` (provider/runtime status)
- `POST /nlp/analyze` (staff/admin text analysis)
- `POST /nlp/grievances/{grievance_id}/analyze` (authorized user analysis by grievance)
- `POST /nlp/cluster` (staff/admin topic clustering across grievances)

## Hardening And Operations

### Rate limiting

- Middleware-based rate limiting is enabled by default.
- Configuration:
  - `RATE_LIMIT_ENABLED` (`true`/`false`)
  - `RATE_LIMIT_MAX_REQUESTS` (default `120`)
  - `RATE_LIMIT_WINDOW_SECONDS` (default `60`)
  - `RATE_LIMIT_EXEMPT_PATHS` (comma-separated path prefixes)
- Responses include:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `Retry-After` (for `429` responses)

### Monitoring hooks

- Request monitoring middleware captures:
  - request count and status distribution
  - latency metrics (average and p95)
  - top routes by traffic
- Responses include:
  - `X-Request-ID`
  - `X-Process-Time-Ms`
- Admin operational metrics endpoint:
  - `GET /health/metrics`

### Backup and restore runbook (Windows PowerShell)

1. Backup database:

```powershell
.\backend\scripts\backup_postgres.ps1 -DatabaseUrl "postgresql+psycopg://root:olayiwola@localhost:5432/grievance" -OutputDir ".\backend\backups"
```

2. Restore database from backup:

```powershell
.\backend\scripts\restore_postgres.ps1 -BackupFile ".\backend\backups\grievance-YYYYMMDD-HHMMSS.dump" -DatabaseUrl "postgresql+psycopg://root:olayiwola@localhost:5432/grievance" -DropExisting -Force
```

3. If PostgreSQL CLI tools are not on `PATH`, pass `-PgBinPath`, for example:

```powershell
.\backend\scripts\backup_postgres.ps1 -PgBinPath "C:\Program Files\PostgreSQL\16\bin"
```

### CI gate

- GitHub Actions workflow at `.github/workflows/ci.yml` runs:
  - backend migrations + tests
  - frontend lint + typecheck + build

## Release Gate Runbook (Section 07)

Run from repository root:

```powershell
.\scripts\release_smoke.ps1
```

What it validates:

- `backend:migrate` succeeds
- Full backend suite succeeds (unit + API + integration)
- Dedicated release integration suite succeeds:
  - `backend/tests/integration/test_e2e_student_flow.py`
  - `backend/tests/integration/test_e2e_staff_flow.py`
  - `backend/tests/integration/test_e2e_admin_flow.py`
- Frontend lint + typecheck succeeds
- Frontend production build succeeds

Deterministic demo reset before live presentation:

1. Restore pre-approved demo backup into dev DB:

```powershell
.\backend\scripts\restore_postgres.ps1 -BackupFile ".\backend\backups\demo-freeze.dump" -DatabaseUrl "postgresql+psycopg://root:olayiwola@localhost:5432/grievance" -DropExisting -Force
```

2. Re-apply migrations:

```powershell
.\scripts\tasks.ps1 backend:migrate
```

3. Start services:

```powershell
.\scripts\tasks.ps1 backend:dev
.\scripts\tasks.ps1 frontend:dev
```

Default seeded roles:

- `student`
- `staff`
- `admin`

## Optional Groq Enablement (LLM Seam)

The backend runs fully without Groq.

To enable Groq later:

1. Set `LLM_PROVIDER=groq` in `backend/.env`.
2. Set a valid `GROQ_API_KEY`.
3. Optionally set `GROQ_MODEL` (default behavior uses `llama-3.1-8b-instant` when unset).
4. Restart backend server.

If the key is missing or provider is not `groq`, the app uses deterministic NoOp outputs.

## Baseline NLP Behavior

Baseline NLP runs without any LLM dependency and provides:

- TF-IDF + linear classification for grievance category suggestions
- Rule-based sentiment scoring
- Rule-based urgency scoring
- Topic clustering for recurring issue discovery
- Deterministic summaries/entities via NoOp provider when Groq is disabled

## PostgreSQL Permission Fix (If Migration Fails)

If `backend:migrate` fails with `permission denied for schema public`, grant schema privileges to user `root` in each database using a superuser account:

```sql
GRANT USAGE, CREATE ON SCHEMA public TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO root;
```

Run the statements once in:

- database `grievance`
- database `grievance_test`

## Manual QA Checklist

1. Run migration successfully on dev DB.
2. Start backend and verify `GET http://localhost:8000/health` returns `{ "status": "ok" }`.
3. Open frontend landing page at `http://localhost:3000` and confirm:
   - hero section and campus image render
   - feature cards with icons render
   - page is responsive on mobile widths
4. Register a user via `/register` and confirm redirect to `/app`.
5. Logout from `/app` and confirm redirect to `/login`.
6. Login with created user and confirm `/app` loads authenticated user info.
7. Call `/auth/me` without token and confirm `401`.
8. Bootstrap an admin user via CLI, then call admin endpoints:
   - `GET /users` returns users with roles
   - `POST /users/{user_id}/roles` assigns role successfully
9. Submit a grievance from frontend `/grievances`, then verify:
   - grievance appears in list and detail view
   - commenting works
   - staff/admin can access triage queue and resolve with note
10. Open frontend `/operations` as staff/admin and verify:
   - department routing works for queue items
   - SLA policy updates persist (admin)
   - `Evaluate SLA` reports breaches/escalations when timers are due
   - breach signals list updates
11. Open frontend `/analytics` as staff/admin and verify:
   - period window buttons (`7/30/90`) refresh data
   - volume trend, category/hotspot panels, and SLA metrics render
   - topic clusters render with keyword + sample title lists
12. Test NLP endpoints as staff/admin:
   - `POST /nlp/analyze` returns category, sentiment, urgency, summary, entities
   - `POST /nlp/cluster` returns topic clusters with grievance members
13. Confirm monitoring headers exist on API responses:
   - `X-Request-ID`
   - `X-Process-Time-Ms`
14. Validate admin metrics endpoint:
   - `GET /health/metrics` returns uptime, request totals, status counts, and top routes
15. Validate rate limiting with repeated requests to a non-exempt endpoint:
   - response transitions to `429` after threshold and includes rate-limit headers
16. Create and verify backup + restore:
   - run `backup_postgres.ps1`
   - run `restore_postgres.ps1` against a test-safe database
17. Run backend tests and frontend lint/typecheck with success.
