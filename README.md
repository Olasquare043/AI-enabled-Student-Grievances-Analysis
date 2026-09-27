# AI-enabled Student Grievances Analysis

AI-enabled Student Grievances Analysis is a full-stack web application for managing student complaints in Nigerian higher institutions.

- **Students** submit grievances.
- **AI triage** classifies, prioritises and routes each complaint, with an explanation of why.
- **Staff** resolve cases against departmental SLAs.
- **Administrators** see analytics, including root-cause topics and early-warning alerts for emerging campus issues.

## What This Project Does

- **Grievance intake.** Students submit complaints; choosing a category is optional.
- **AI triage on submission.** A trained text classifier predicts the responsible category, and a supervised model
  predicts urgency. Together they set a priority (P1–P4).
- **Explainable, human-in-the-loop routing.**
  - A grievance is auto-routed only when the model is confident enough.
  - Everything else waits in the intake queue for staff.
  - Each decision shows the words that drove it (linear SHAP values).
  - Staff corrections are audited and reported as an override rate.
- **Root-cause analysis.** LDA topic modelling groups complaints into themes, and a weekly spike detector raises
  emerging-issue alerts.
- **SLA management.** Deadlines, breaches and escalations are tracked per department.
- **Role-based access.** There are separate student, staff and admin workspaces, with JWT authentication.

## AI models and dataset

| Component | Method | Held-out result |
| --- | --- | --- |
| Category classifier | TF-IDF + Logistic Regression (compared with Centroid, Naive Bayes, Linear SVM) | 93.8% accuracy, 0.936 macro-F1 |
| Auto-routing | Confidence threshold chosen for ≥97% routed accuracy | 88% of cases auto-routed at 97.6% accuracy |
| Urgency | TF-IDF + Logistic Regression (vs keyword rules) | 84% accuracy (rules: 37%) |
| Explanations | Exact linear SHAP; deletion faithfulness test | p < 0.001 (Wilcoxon) |
| Topics | LDA, k chosen by NPMI coherence (k = 20) | 4/4 planted issues detected within 0–2 days |

For comparison, the category students pick themselves is correct 81% of the time.

The system is trained and evaluated on a **synthetic** dataset of 4,000 Nigerian student grievances spanning 18
months, with academic-calendar seasonality and four planted emerging issues. See
[backend/data/DATASET_CARD.md](backend/data/DATASET_CARD.md). Full metrics are in
[backend/app/ml/artifacts/metrics.json](backend/app/ml/artifacts/metrics.json), and thesis figures are in
[docs/figures](docs/figures).

Reproduce everything (Python 3.12):

```bash
cd backend
pip install -r requirements-dev.txt
python -m app.data_gen.generate_dataset --seed 42      # regenerate the dataset
python -m app.ml.train --figures ../docs/figures       # train, evaluate, export models + figures (~5 min)
```

## Run Locally (Docker)

You need Git and [Docker Desktop](https://www.docker.com/products/docker-desktop/), with Docker Desktop running.

```bash
git clone https://github.com/Olasquare043/AI-enabled-Student-Grievances-Analysis.git
cd AI-enabled-Student-Grievances-Analysis
docker compose up
```

The first start builds the containers, runs migrations and loads the dataset, which takes a few minutes. Then open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

If port 5432 is already used by a local PostgreSQL, run `POSTGRES_PORT=55432 docker compose up`.

To reload fresh demo data later (the dates are re-anchored to "now"):

```bash
docker compose exec backend python -m app.scripts.seed_demo_data --force-reset
```

## Demo Login Details

All accounts use the password `password123`.

| Role | Email |
| --- | --- |
| Admin | `admin@gmail.com` |
| Admin | `dean.students@campuspulse.edu.ng` |
| Student | `ola2@gmail.com` |
| Student | `adeyemi.omooba@gmail.com` |
| Staff (Registry) | `grace.adebayo@campuspulse.edu.ng` |
| Staff (ICT Support) | `martins.okafor@campuspulse.edu.ng` |

## Deploy For Free (Supabase + Render + Vercel)

| Part | Service | Free tier notes |
| --- | --- | --- |
| Database | Supabase Postgres | 500 MB; pauses after 7 days without activity |
| Backend API | Render web service | 512 MB RAM; sleeps after 15 min idle (first request then takes ~50 s) |
| Frontend | Vercel | Proxies `/api/*` to Render, so no CORS setup is needed in the browser |

### 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) and note the database password.
2. Open **Connect → Session pooler** and copy the URI, for example
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   Use the **session pooler**, because Render cannot reach Supabase's IPv6-only direct host.
3. Load the schema and the dataset once, from your machine. With Docker:

   ```bash
   docker compose build backend
   docker compose run --rm --no-deps --entrypoint python -e DATABASE_URL="<supabase-uri>" backend -m alembic -c alembic.ini upgrade head
   docker compose run --rm --no-deps --entrypoint python -e DATABASE_URL="<supabase-uri>" backend -m app.scripts.seed_demo_data --force-reset
   ```

   Or with Python 3.12, from `backend/`: `pip install -r requirements.txt`, set `DATABASE_URL` and `JWT_SECRET`, then
   run the same two `python -m ...` commands.

### 2. Backend (Render)

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository. [render.yaml](render.yaml) defines the service.
3. When prompted, set:
   - `DATABASE_URL`: the Supabase session-pooler URI.
   - `CORS_ORIGINS`: your Vercel URL (you can add it after step 3).
4. Deploy, then check `https://<service>.onrender.com/health`. It should return `{"status":"ok"}`.

### 3. Frontend (Vercel)

1. In Vercel, choose **Add New → Project**, import the repository, and set **Root Directory** to `frontend`.
2. Add these environment variables before the first build:
   - `INTERNAL_API_BASE_URL` = `https://<service>.onrender.com`
   - `NEXT_PUBLIC_API_BASE_URL` = `/api`
3. Deploy and open the Vercel URL.

### 4. Keep it awake (optional)

Create a free job at [cron-job.org](https://cron-job.org) that calls `https://<service>.onrender.com/health` every
10 minutes. This keeps Render warm, and because `/health` queries the database, it also stops Supabase from pausing.

## Tests

```bash
cd backend && DATABASE_URL=postgresql+psycopg://app:app_password@localhost:5432/student_grievances_test pytest
cd frontend && npm run lint && npm run typecheck && npm run build
```

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- AI/ML: scikit-learn (TF-IDF, Logistic Regression, Linear SVM, Naive Bayes, LDA), with optional Groq LLM summaries
- Hosting: Docker Compose (local); Supabase, Render and Vercel (cloud)
