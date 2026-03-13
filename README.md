# AI-enabled Student Grievances Analysis

AI-enabled Student Grievances Analysis is a full-stack grievance management platform for higher institutions. It combines secure student submission, operational triage, SLA tracking, analytics, optional LLM-assisted summaries, and an admin workspace for user and data management.

This repository contains:

- `backend/`: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, JWT auth, RBAC, analytics, NLP, SLA and routing logic
- `frontend/`: Next.js App Router, TypeScript, Tailwind CSS, responsive dashboard workspace, operations boards, analytics, and admin tools

## What The System Covers

- Student grievance submission and tracking
- Staff and admin triage workflow
- Routing to operational departments
- SLA policy management and breach detection
- Analytics for backlog, trends, hotspots, and compliance
- Optional LLM enrichment with deterministic fallback
- Admin user management and CSV grievance import

## Tech Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy 2.0
- Alembic
- PostgreSQL
- Psycopg

### Frontend

- Node.js 22+
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide icons

### Optional Services

- Redis for shared analytics caching
- Groq for LLM enrichment

Redis is optional. No subscription is required if you run Redis locally or self-host it. Managed Redis only costs money if you choose a hosted provider.

## Repository Layout

```text
backend/
  app/
    api/
    models/
    schemas/
    services/
    scripts/
  alembic/
frontend/
  app/
  components/
  lib/
scripts/
  tasks.ps1
  release_smoke.ps1
```

## Fresh Setup On A New Device

These steps assume the repository has already been cloned.

### 1. Install Required Tooling

- Git
- Python 3.12 or newer
- Node.js 22 or newer
- npm
- PostgreSQL 15 or newer
- Optional: Redis

### 2. Create Environment Files

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

### 3. Configure The Backend Environment

Open `backend/.env` and set values for your own machine.

Example:

```dotenv
DATABASE_URL=postgresql+psycopg://root:your_password@localhost:5432/grievance
TEST_DATABASE_URL=postgresql+psycopg://root:your_password@localhost:5432/grievance_test
CACHE_BACKEND=auto
REDIS_URL=redis://localhost:6379/0
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

Notes:

- `DATABASE_URL` must point to your development database.
- `TEST_DATABASE_URL` must point to a separate test database.
- `CACHE_BACKEND=auto` is the recommended default.
- Leave `LLM_PROVIDER=none` unless you are intentionally enabling Groq.

### 4. Configure The Frontend Environment

`frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### 5. Create The Databases

If the databases do not already exist, create them:

```powershell
createdb grievance
createdb grievance_test
```

If `createdb` is not available on `PATH`, use `psql`:

```powershell
psql -U postgres -c "CREATE DATABASE grievance;"
psql -U postgres -c "CREATE DATABASE grievance_test;"
```

### 6. Install Dependencies

Backend:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

Frontend:

```powershell
cd frontend
npm install
cd ..
```

### 7. Run Database Migrations

```powershell
.\scripts\tasks.ps1 backend:migrate
```

### 8. Seed Fresh Demo Data

This reseeds the development database with realistic demo records for all dashboards.

```powershell
.\scripts\tasks.ps1 backend:seed
```

Direct command:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.scripts.seed_demo_data --force-reset
cd ..
```

Important:

- The seeder is destructive for the development database.
- It refuses to run against the test database.
- It resets users, grievances, routing history, SLA events, and reference data, then rebuilds the demo dataset.

### 9. Start The Application

Backend:

```powershell
.\scripts\tasks.ps1 backend:dev
```

Equivalent direct command:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd ..
```

Frontend:

```powershell
.\scripts\tasks.ps1 frontend:dev
```

Equivalent direct command:

```powershell
cd frontend
npm run dev
cd ..
```

Frontend runs at `http://127.0.0.1:3000` and backend runs at `http://127.0.0.1:8000`.

## Seeded Demo Accounts

All demo accounts use the password `password123`.

### Admin

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| admin | System Administrator | `admin@gmail.com` | `password123` |

### Students

| Role | Name | Email | Matric Number | Faculty | Department | Level |
| --- | --- | --- | --- | --- | --- | --- |
| student | Saheed Olayemi Olayinka | `ola2@gmail.com` | `CSC/24/214906` | Science | Computer Science | 500 |
| student | Adeyemi Omooba | `adeyemi.omooba@gmail.com` | `ACC/24/214905` | Management Sciences | Accounting | 400 |

Note: the requested `ola2gmail.com` seed login was normalized to the valid email `ola2@gmail.com` because authentication requires a valid email address.

### Staff

| Role | Name | Email | Staff ID | Unit |
| --- | --- | --- | --- | --- |
| staff | Grace Adebayo | `grace.adebayo@campuspulse.edu.ng` | `STF/OPS/0001` | Registry Operations |
| staff | Martins Okafor | `martins.okafor@campuspulse.edu.ng` | `STF/OPS/0002` | ICT Support |

The seeded grievance history spans 7, 30, and 90 day reporting windows so the dashboard period filters, charts, SLA views, category distribution, hotspots, and operational queues all have meaningful data.

## Day-To-Day Commands

### Backend

```powershell
.\scripts\tasks.ps1 backend:dev
.\scripts\tasks.ps1 backend:migrate
.\scripts\tasks.ps1 backend:test
.\scripts\tasks.ps1 backend:seed
```

### Frontend

```powershell
.\scripts\tasks.ps1 frontend:dev
.\scripts\tasks.ps1 frontend:check
.\scripts\tasks.ps1 frontend:build
```

### Full Smoke Gate

```powershell
.\scripts\tasks.ps1 release:smoke
```

On Windows, run `frontend:build` in a fresh PowerShell session after `release:smoke`. The smoke script intentionally skips the inline Next.js production build there because long-lived PowerShell sessions can trigger Turbopack `spawn EPERM`.

## Feature Areas

### Authentication And Roles

- JWT login/logout
- Role-based access control
- Exclusive role assignment for `student`, `staff`, and `admin`
- Admin user management

### Grievance Workflow

- Student submission form
- Grievance list and detail pages
- Comments and status history
- Staff/admin assignment and routing

### Operations

- Unrouted intake queue
- Routed operations queue
- SLA breach scan
- Active breach tracking
- Department SLA policy management

### Analytics And NLP

- Volume trend
- Category distribution
- Department and faculty hotspots
- Backlog and compliance metrics
- Topic clustering
- AI-assisted operational and grievance briefs with deterministic fallback

## Optional Redis And Groq Setup

### Redis

Recommended local default:

```dotenv
CACHE_BACKEND=auto
REDIS_URL=redis://localhost:6379/0
```

Behavior:

- If Redis is reachable, analytics caching uses Redis.
- If Redis is not reachable, the backend falls back to in-memory caching.

### Groq

Enable only if you have a valid API key.

```dotenv
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

If Groq is not configured, the platform still works with deterministic NLP outputs.

## Common Errors, Mistakes, And Fixes

### 1. `uvicorn` rejects `-reload`

Wrong:

```powershell
uvicorn app.main:app -reload
```

Correct:

```powershell
uvicorn app.main:app --reload
```

### 2. Frontend says it cannot reach the backend API

Symptoms:

- Toast says backend is unavailable
- Dashboard partially loads
- Login or delete actions fail with connection errors

Fix:

- Start the backend server
- Confirm `NEXT_PUBLIC_API_BASE_URL` points to `http://127.0.0.1:8000`
- Open `http://127.0.0.1:8000/health`

### 3. PostgreSQL migration fails with `permission denied for schema public`

Run these once as a PostgreSQL superuser in both `grievance` and `grievance_test`:

```sql
GRANT USAGE, CREATE ON SCHEMA public TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO root;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO root;
```

### 4. Seeder refuses to run

Likely causes:

- `--force-reset` was not supplied
- `DATABASE_URL` points to the test database

Fix:

- Use `.\scripts\tasks.ps1 backend:seed`
- Confirm `DATABASE_URL` is the development DB, not `grievance_test`

### 5. Admin cannot delete some users

That is expected if the user has already submitted grievances. Those records are part of the grievance history and are protected from normal hard-delete.

Use one of these instead:

- mark the account inactive from the edit modal
- remove the user’s grievance records first if you truly want a hard delete

### 6. Frontend build fails on Windows after several other frontend commands

Run the production build in a fresh PowerShell session:

```powershell
.\scripts\tasks.ps1 frontend:build
```

### 7. Hydration mismatch warnings appear in development

Common cause:

- browser extensions such as Grammarly injecting attributes into the page

Fix:

- hard refresh
- disable the extension for localhost

## Quality Checks

Backend tests:

```powershell
.\scripts\tasks.ps1 backend:test
```

Frontend lint and typecheck:

```powershell
.\scripts\tasks.ps1 frontend:check
```

Frontend production build:

```powershell
.\scripts\tasks.ps1 frontend:build
```

Full release verification:

```powershell
.\scripts\tasks.ps1 release:smoke
```

## Production Notes

- Change all demo passwords before any real deployment.
- Replace the demo `JWT_SECRET` with a strong secret.
- Do not run the demo seeder against a real production database.
- Keep Redis optional unless your deployment explicitly depends on it.
- Keep Groq optional unless you want external LLM enrichment in that environment.
- The demo seeder is for local development, demos, and onboarding only.

## Backup And Restore

Backup:

```powershell
.\backend\scripts\backup_postgres.ps1 -DatabaseUrl "postgresql+psycopg://root:your_password@localhost:5432/grievance" -OutputDir ".\backend\backups"
```

Restore:

```powershell
.\backend\scripts\restore_postgres.ps1 -BackupFile ".\backend\backups\grievance-YYYYMMDD-HHMMSS.dump" -DatabaseUrl "postgresql+psycopg://root:your_password@localhost:5432/grievance" -DropExisting -Force
```

## License And Use

This repository is currently structured as a project workspace and demo platform. If you plan to publish or deploy it beyond local/private use, add the license and deployment policy that match your organization.
