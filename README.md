# AI-enabled Student Grievances Analysis

AI-enabled Student Grievances Analysis is a full-stack web application for managing student complaints in higher institutions. Students can submit grievances, staff can review and resolve them, and administrators can monitor activity through dashboards and reports.

This project is already Dockerized, so beginners can run it without installing Python, Node.js, npm, or PostgreSQL on their machine.

## What This Project Does

- Accepts student grievance submissions
- Supports student, staff, and admin login
- Routes grievances to departments
- Tracks grievance status and SLA deadlines
- Shows analytics and reports
- Includes AI-assisted summaries with fallback behavior

## What You Need

- Git
- Docker Desktop

Download Docker Desktop:

- https://www.docker.com/products/docker-desktop/

## Before You Start

1. Install Docker Desktop.
2. Open Docker Desktop.
3. Wait until Docker Desktop shows that it is running.

## Run The Project

### 1. Clone the repository

```bash
git clone https://github.com/Olasquare043/AI-enabled-Student-Grievances-Analysis.git
cd AI-enabled-Student-Grievances-Analysis
```

### 2. Start the application

```bash
docker compose up
```

The first startup can take a few minutes. Docker will automatically:

- build the containers
- start the database
- run database migrations
- load demo data
- start the backend and frontend

You do not need to create any `.env` file for the first run.

### 3. Open the app

When startup is complete, open:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/health`
- Backend API docs: `http://localhost:8000/docs`

## Demo Login Details

Use any of these accounts after the app starts:

- Admin: `admin@gmail.com` / `password123`
- Student: `ola2@gmail.com` / `password123`
- Student: `adeyemi.omooba@gmail.com` / `password123`
- Staff: `grace.adebayo@campuspulse.edu.ng` / `password123`
- Staff: `martins.okafor@campuspulse.edu.ng` / `password123`

## Stop The Project

Press `Ctrl + C` in the terminal where `docker compose up` is running.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Containers: Docker and Docker Compose
