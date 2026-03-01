# AI-enabled Student Grievances Analysis Remaining Task Split (Sections Only)

Last updated: 2026-03-01

Legend:
- `[❌]` not started
- `[🟡]` in progress / partially complete
- `[✅]` complete and verified

## How To Use This Document

1. Work section-by-section in order.
2. For each section, update file-level checkboxes under "Files checklist".
3. Update task-level checkboxes under "Task checklist".
4. Mark section complete only after its test gate is verified.

---

## [✅] Section 01 - Monorepo Scaffolding + Local Postgres + Auth (JWT) + RBAC + UI Shell + Optional LLM Seam

### Files checklist
- [✅] `README.md`
- [✅] `.gitignore`
- [✅] `scripts/tasks.ps1`
- [✅] `backend/.env.example`
- [✅] `backend/requirements.txt`
- [✅] `backend/requirements-dev.txt`
- [✅] `backend/pytest.ini`
- [✅] `backend/alembic.ini`
- [✅] `backend/alembic/env.py`
- [✅] `backend/alembic/script.py.mako`
- [✅] `backend/alembic/versions/20260227_0001_initial_schema.py`
- [✅] `backend/alembic/versions/20260301_0002_user_profile_fields.py`
- [✅] `backend/app/main.py`
- [✅] `backend/app/core/config.py`
- [✅] `backend/app/core/security.py`
- [✅] `backend/app/core/logging.py`
- [✅] `backend/app/db/base.py`
- [✅] `backend/app/db/session.py`
- [✅] `backend/app/models/user.py`
- [✅] `backend/app/models/role.py`
- [✅] `backend/app/models/audit_log.py`
- [✅] `backend/app/schemas/auth.py`
- [✅] `backend/app/schemas/user.py`
- [✅] `backend/app/services/auth_service.py`
- [✅] `backend/app/services/user_service.py`
- [✅] `backend/app/api/router.py`
- [✅] `backend/app/api/deps.py`
- [✅] `backend/app/api/endpoints/health.py`
- [✅] `backend/app/api/endpoints/auth.py`
- [✅] `backend/app/api/endpoints/users.py`
- [✅] `backend/app/llm/base.py`
- [✅] `backend/app/llm/factory.py`
- [✅] `backend/app/llm/groq_provider.py`
- [✅] `backend/app/llm/prompts.py`
- [✅] `backend/app/scripts/create_admin.py`
- [✅] `backend/app/tests/conftest.py`
- [✅] `backend/app/tests/test_auth_flow.py`
- [✅] `backend/app/tests/test_rbac_seed.py`
- [✅] `backend/app/tests/test_llm_factory.py`
- [✅] `backend/app/tests/test_section01_api_smoke.py`
- [✅] `frontend/.env.example`
- [✅] `frontend/package.json`
- [✅] `frontend/app/layout.tsx`
- [✅] `frontend/app/globals.css`
- [✅] `frontend/app/page.tsx`
- [✅] `frontend/app/login/page.tsx`
- [✅] `frontend/app/register/page.tsx`
- [✅] `frontend/app/app/page.tsx`
- [✅] `frontend/components/app-shell.tsx`
- [✅] `frontend/components/ui/button.tsx`
- [✅] `frontend/components/ui/card.tsx`
- [✅] `frontend/components/ui/input.tsx`
- [✅] `frontend/components/ui/label.tsx`
- [✅] `frontend/components/ui/toast-banner.tsx`
- [✅] `frontend/lib/api.ts`
- [✅] `frontend/lib/auth.ts`
- [✅] `frontend/lib/types.ts`
- [✅] `frontend/lib/utils.ts`
- [✅] `frontend/public/campus-support.svg`

### Task checklist
- [✅] Monorepo scaffolding completed (`backend/`, `frontend/`, root docs, root task runner).
- [✅] Backend environment configuration implemented with required/optional variables.
- [✅] SQLAlchemy 2.0 models and session setup implemented.
- [✅] Alembic baseline migration created and applied.
- [✅] JWT auth implemented (`register`, `login`, `logout`, `me`).
- [✅] RBAC implemented (`student`, `staff`, `admin`; admin guard; role assignment endpoint).
- [✅] Idempotent role seeding implemented.
- [✅] Admin bootstrap CLI implemented.
- [✅] Health endpoint implemented.
- [✅] Optional LLM seam implemented (NoOp fallback + optional Groq provider).
- [✅] Backend tests implemented and passing.
- [✅] Next.js professional shell implemented (landing, login, register, protected dashboard).
- [✅] Frontend auth flow implemented (cookie + sessionStorage fallback).
- [✅] Dashboard profile update flow implemented (`PATCH /users/me`).
- [✅] Registration captures `first_name`, `last_name`, `matric_number`.
- [✅] Login/register success toasts implemented.

### Test gate
- [✅] `./scripts/tasks.ps1 backend:test` -> passing (`31 passed`, includes automated `test_section01_api_smoke.py`, hardening tests, and release integration tests).
- [✅] `./scripts/tasks.ps1 frontend:check` -> passing.
- [✅] `./scripts/tasks.ps1 backend:migrate` -> passing to latest revision (`20260301_0004`).
- [✅] Automated smoke validated via API test (`health`, `register`, `login`, `me`, `PATCH /users/me`, `logout`).

---

## [✅] Section 02 - Grievance MVP Workflow (Submit, Track, Triage, Status, Comments, Audit)

### Files checklist
- [✅] `backend/alembic/versions/20260301_0003_grievance_mvp.py`
- [✅] `backend/app/models/grievance.py`
- [✅] `backend/app/models/grievance_comment.py`
- [✅] `backend/app/models/grievance_status_history.py`
- [✅] `backend/app/schemas/grievance.py`
- [✅] `backend/app/services/grievance_service.py`
- [✅] `backend/app/services/grievance_comment_service.py`
- [✅] `backend/app/api/endpoints/grievances.py`
- [✅] `backend/app/api/router.py`
- [✅] `backend/app/db/base.py`
- [✅] `backend/app/models/user.py`
- [✅] `backend/app/tests/conftest.py`
- [✅] `backend/app/tests/test_grievance_flow.py`
- [✅] `frontend/app/grievances/page.tsx`
- [✅] `frontend/app/grievances/[id]/page.tsx`
- [✅] `frontend/components/grievance/grievance-form.tsx`
- [✅] `frontend/components/grievance/grievance-comments.tsx`
- [✅] `frontend/components/app-shell.tsx`
- [✅] `frontend/lib/grievance-api.ts`
- [✅] `frontend/lib/api.ts`
- [✅] `frontend/lib/types.ts`

### Task checklist
- [✅] Student grievance submission endpoint.
- [✅] Grievance list and detail endpoints with ownership filtering.
- [✅] Status transitions (`open -> in_progress -> resolved/closed`).
- [✅] Staff triage queue basics.
- [✅] Commenting on grievances.
- [✅] Audit events for grievance lifecycle actions.
- [✅] Frontend grievance submission + tracking UI.

### Test gate
- [✅] Contract tests for grievance endpoints (`backend/app/tests/test_grievance_flow.py`) passing.
- [✅] Integration flow test (`submit -> triage -> assign -> resolve`) passing.
- [✅] Frontend lint/typecheck/build passing after grievance pages added.

---

## [✅] Section 03 - Routing + SLA + Escalation

### Files checklist
- [✅] `backend/alembic/versions/20260301_0004_routing_sla.py`
- [✅] `backend/app/models/department.py`
- [✅] `backend/app/models/grievance_assignment.py`
- [✅] `backend/app/models/sla_policy.py`
- [✅] `backend/app/models/sla_event.py`
- [✅] `backend/app/models/escalation_rule.py`
- [✅] `backend/app/models/grievance.py` (routing/SLA fields)
- [✅] `backend/app/db/base.py` (model registry updates)
- [✅] `backend/app/main.py` (seed initialization updates)
- [✅] `backend/app/schemas/routing.py`
- [✅] `backend/app/schemas/sla.py`
- [✅] `backend/app/schemas/grievance.py` (department/SLA fields in grievance responses)
- [✅] `backend/app/services/routing_service.py`
- [✅] `backend/app/services/sla_service.py`
- [✅] `backend/app/services/escalation_service.py`
- [✅] `backend/app/services/grievance_service.py` (SLA hooks + assignment history hook)
- [✅] `backend/app/services/grievance_comment_service.py` (first-response hook on staff/admin comment)
- [✅] `backend/app/api/endpoints/operations.py`
- [✅] `backend/app/api/router.py` (operations router registration)
- [✅] `backend/app/tests/conftest.py` (department/SLA/escalation seed fixtures)
- [✅] `backend/app/tests/test_routing_sla.py`
- [✅] `frontend/app/operations/page.tsx`
- [✅] `frontend/components/operations/sla-board.tsx`
- [✅] `frontend/components/app-shell.tsx` (operations navigation)
- [✅] `frontend/lib/operations-api.ts`
- [✅] `frontend/lib/types.ts` (operations + SLA types)

### Task checklist
- [✅] Department routing for grievances.
- [✅] Assignment logic for responsible officers.
- [✅] SLA policy configuration and timers.
- [✅] First-response and resolution-time tracking.
- [✅] Escalation rules and breach signals.
- [✅] Operations view for routing/SLA status.

### Test gate
- [✅] SLA clock + breach simulation tests (`test_routed_case_breaches_sla_and_triggers_escalation`).
- [✅] Escalation trigger tests (`/operations/sla/evaluate` creates escalation events, `GET /operations/sla/breaches` confirms counts).
- [✅] End-to-end test: routed case breaches SLA and escalates (`backend/app/tests/test_routing_sla.py`).

---

## [✅] Section 04 - Baseline NLP + Optional Groq Enhancements

### Files checklist
- [✅] `backend/app/nlp/__init__.py`
- [✅] `backend/app/nlp/classifier.py`
- [✅] `backend/app/nlp/vectorizer.py`
- [✅] `backend/app/nlp/sentiment.py`
- [✅] `backend/app/nlp/urgency.py`
- [✅] `backend/app/nlp/topic_cluster.py`
- [✅] `backend/app/schemas/nlp.py`
- [✅] `backend/app/services/nlp_service.py`
- [✅] `backend/app/services/llm_enrichment_service.py`
- [✅] `backend/app/api/endpoints/nlp.py`
- [✅] `backend/app/api/router.py` (NLP router registration)
- [✅] `backend/app/tests/test_nlp_pipeline.py`
- [✅] `backend/app/tests/test_llm_enrichment.py`
- [✅] `README.md` (NLP endpoint and QA documentation updates)

### Task checklist
- [✅] Baseline category/subcategory prediction (non-LLM).
- [✅] Sentiment scoring pipeline.
- [✅] Urgency scoring pipeline.
- [✅] Topic clustering for recurring issue discovery.
- [✅] Optional Groq enrichment (summaries/entities) behind feature flag.
- [✅] Ensure app remains fully functional when LLM is disabled.

### Test gate
- [✅] Unit tests for baseline NLP components (`backend/app/tests/test_nlp_pipeline.py`).
- [✅] Integration tests for NLP output on sample grievances (`POST /nlp/grievances/{id}/analyze`, `POST /nlp/cluster`).
- [✅] Tests validating safe NoOp behavior when Groq key is missing (`backend/app/tests/test_llm_enrichment.py`).

---

## [✅] Section 05 - Analytics Dashboards + Topic Mining Views

### Files checklist
- [✅] `backend/app/schemas/analytics.py`
- [✅] `backend/app/services/analytics_service.py`
- [✅] `backend/app/services/nlp_service.py` (analytics time-window support for clustering)
- [✅] `backend/app/api/endpoints/analytics.py`
- [✅] `backend/app/api/router.py` (analytics router registration)
- [✅] `backend/app/tests/test_analytics_endpoints.py`
- [✅] `frontend/app/analytics/page.tsx`
- [✅] `frontend/components/analytics/trend-chart.tsx`
- [✅] `frontend/components/analytics/category-hotspots.tsx`
- [✅] `frontend/components/analytics/sla-compliance.tsx`
- [✅] `frontend/components/analytics/topic-clusters.tsx`
- [✅] `frontend/components/app-shell.tsx` (analytics navigation links)
- [✅] `frontend/lib/analytics-api.ts`
- [✅] `frontend/lib/types.ts` (analytics response types)
- [✅] `README.md` (analytics API + QA checklist updates)

### Task checklist
- [✅] Analytics overview endpoint implemented (`GET /analytics/overview`).
- [✅] Volume trends over time implemented (daily series for configurable period).
- [✅] Top categories, department hotspots, and faculty hotspots implemented.
- [✅] Resolution-time and backlog metrics implemented.
- [✅] SLA compliance analytics + escalation/breach summary implemented.
- [✅] Topic-cluster insights endpoint implemented (`GET /analytics/topic-clusters`).
- [✅] Frontend analytics dashboard implemented with responsive cards/charts/tables.
- [✅] Analytics route integrated into dashboard navigation.

### Test gate
- [✅] `./scripts/tasks.ps1 backend:test` -> passing (`31 passed`, includes `test_analytics_endpoints.py` + release integration tests).
- [✅] `./scripts/tasks.ps1 frontend:check` -> passing.
- [✅] `npm run build` (frontend) -> passing with `/analytics` route compiled.
- [✅] Live browser E2E validation for `/analytics` with seeded grievances -> passing (headless browser login + analytics render; screenshot: `frontend/.artifacts/analytics-e2e.png`).

---

## [✅] Section 06 - Hardening (Rate Limits, Monitoring, Backups, Deployment Readiness)

### Files checklist
- [✅] `backend/app/middleware/__init__.py`
- [✅] `backend/app/middleware/rate_limit.py`
- [✅] `backend/app/core/monitoring.py`
- [✅] `backend/app/core/config.py` (hardening settings/env parsing)
- [✅] `backend/app/main.py` (middleware registration + app state wiring)
- [✅] `backend/app/api/endpoints/health.py` (admin metrics endpoint)
- [✅] `backend/app/tests/conftest.py` (test env toggles for limiter/monitoring)
- [✅] `backend/app/tests/test_rate_limit.py`
- [✅] `backend/scripts/backup_postgres.ps1`
- [✅] `backend/scripts/restore_postgres.ps1`
- [✅] `.github/workflows/ci.yml`
- [✅] `backend/.env.example` (hardening env defaults + actual DB template URLs)
- [✅] `.gitignore` (backup/artifact ignore rules)
- [✅] `README.md` (hardening, backup/restore, CI runbook updates)

### Task checklist
- [✅] API rate limiting middleware implemented with configurable thresholds/window and exempt paths.
- [✅] Rate-limit headers + `429` retry behavior implemented (`X-RateLimit-*`, `Retry-After`).
- [✅] Structured request monitoring middleware implemented (`X-Request-ID`, latency, status counters, top routes).
- [✅] Admin-only metrics endpoint implemented (`GET /health/metrics`).
- [✅] PostgreSQL backup script implemented for local Windows workflows.
- [✅] PostgreSQL restore script implemented with safe in-place clean restore option (`-DropExisting`).
- [✅] CI workflow implemented for backend migrations/tests and frontend lint/typecheck/build.
- [✅] Deployment/readiness and hardening runbook documented in README.

### Test gate
- [✅] `./scripts/tasks.ps1 backend:test` -> passing (`31 passed`, includes `test_rate_limit.py` + release integration tests).
- [✅] `./scripts/tasks.ps1 frontend:check` -> passing.
- [✅] `./scripts/tasks.ps1 backend:migrate` -> passing.
- [✅] Local backup verification -> passing: `backup_postgres.ps1` generated `.dump` and `.meta.json`.
- [✅] Local restore verification -> passing: `restore_postgres.ps1 -DropExisting -Force` restored `grievance_test`.
- [✅] Post-restore regression pass -> `./scripts/tasks.ps1 backend:test` passing (`31 passed`).

---

## [✅] Section 07 - Release Gate (E2E Validation + Demo Freeze)

### Files checklist
- [✅] `backend/pytest.ini` (integration test path registration)
- [✅] `backend/tests/integration/__init__.py`
- [✅] `backend/tests/integration/conftest.py`
- [✅] `backend/tests/integration/helpers.py`
- [✅] `backend/tests/integration/test_e2e_student_flow.py`
- [✅] `backend/tests/integration/test_e2e_staff_flow.py`
- [✅] `backend/tests/integration/test_e2e_admin_flow.py`
- [✅] `scripts/release_smoke.ps1`
- [✅] `scripts/tasks.ps1` (`release:smoke` task wiring)
- [✅] `README.md` (final release runbook + demo checklist)

### Task checklist
- [✅] Execute full student->staff->admin end-to-end flow with integration tests.
- [✅] Verify analytics and AI insights paths during integration and release smoke runs.
- [✅] Freeze demo-state process documented with deterministic restore-first runbook.
- [✅] Final acceptance pass executed across all sections.

### Test gate
- [✅] Full E2E integration suite pass -> `python -m pytest tests/integration -q` (`3 passed`).
- [✅] Manual demo script equivalent automated pass -> `./scripts/release_smoke.ps1` passing.
- [✅] Final release checklist sign-off -> `./scripts/tasks.ps1 release:smoke` passing end-to-end.
