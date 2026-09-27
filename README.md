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

## Tests

```bash
cd backend && DATABASE_URL=postgresql+psycopg://app:app_password@localhost:5432/student_grievances_test pytest
cd frontend && npm run lint && npm run typecheck && npm run build
```

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- AI/ML: scikit-learn (TF-IDF, Logistic Regression, Linear SVM, Naive Bayes, LDA), with optional Groq LLM summaries
- Local runtime: Docker Compose
