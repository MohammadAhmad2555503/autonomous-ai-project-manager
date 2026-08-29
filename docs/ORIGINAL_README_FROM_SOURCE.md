# Autonomous AI Project Manager

A full-stack project management MVP with projects, tasks, dependency mapping, project analytics, deterministic delay-risk scoring, and automated project summaries.

This repository is now set up as a demo/internal-pilot application, not a turnkey production deployment. Production use still requires deployment hardening, secret management, backup/restore planning, monitoring, and organization-specific privacy review.

## Features

- Cookie-based authentication with JWT bearer-token compatibility.
- Role-aware access control for admins, project managers, and team members.
- Project create, read, update, and delete APIs.
- Task create, read, update, and delete APIs.
- Task comments.
- Task dependency creation/deletion with duplicate, self-dependency, cross-project, and cycle checks.
- Dependency graph visualization with computed critical-path highlighting.
- Project analytics for task status, overdue work, high-risk work, and team workload.
- Deterministic delay-risk scoring.
- AI insight endpoints for project health, top risks, recommendations, and stakeholder summaries.
- Mock AI fallback when no external system key is configured.
- Seed data for local demos.

## Tech Stack

Frontend:

- React with React Router
- Tailwind CSS and shadcn/Radix-style UI components
- ReactFlow
- Recharts
- Axios
- Sonner

Backend:

- FastAPI
- MongoDB with Motor
- Pydantic validation
- bcrypt password hashing
- JWT authentication
- Optional Emergent external system integration

## Requirements

- Node.js 18 or newer
- npm or Yarn
- Python 3.11 or newer
- MongoDB running locally or reachable through `MONGO_URL`

## Environment Setup

Backend:

```bash
cd backend
cp .env.example .env
```

Set a strong `JWT_SECRET` before any shared deployment. For production, set `APP_ENV=production`, `COOKIE_SECURE=true`, and set `CORS_ORIGINS` to the exact frontend origins.

Frontend:

```bash
cd frontend
cp .env.example .env
```

If the API is served from the same origin as the frontend, `REACT_APP_BACKEND_URL` may be left empty. For local split frontend/backend development, use `http://localhost:8000`.

## Install

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py
```

Frontend:

```bash
cd frontend
npm install
```

Commit the generated `package-lock.json` after a clean install so future builds are reproducible.

## Run Locally

Backend:

```bash
cd backend
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm start
```

Open `http://localhost:3000`.

## Demo Accounts

After `python seed.py`:

- Admin: `admin@demo.com` / `demo-password`
- Project manager: `sarah@demo.com` / `demo-password`
- Team members:
  - `marcus@demo.com` / `demo-password`
  - `aisha@demo.com` / `demo-password`
  - `david@demo.com` / `demo-password`

## API Overview

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Users:

- `GET /api/users`
- `GET /api/users/{user_id}`

Projects:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`
- `DELETE /api/projects/{project_id}`

Tasks:

- `GET /api/tasks`
- `GET /api/tasks?project_id={project_id}`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `PATCH /api/tasks/{task_id}`
- `DELETE /api/tasks/{task_id}`

Dependencies:

- `GET /api/dependencies`
- `GET /api/dependencies?project_id={project_id}`
- `POST /api/dependencies`
- `DELETE /api/dependencies/{dependency_id}`

Comments:

- `GET /api/comments/{task_id}`
- `POST /api/comments`

Analytics and AI:

- `GET /api/analytics/project/{project_id}`
- `GET /api/analytics/task-risk/{task_id}`
- `POST /api/ai/project-health/{project_id}`
- `POST /api/ai/top-risks/{project_id}`
- `POST /api/ai/recommendations/{project_id}`
- `POST /api/ai/stakeholder-summary/{project_id}`
- `GET /api/ai/insights/{project_id}`

Interactive API docs are available at `/docs` when the backend is running.

## Testing

The included `backend_test.py` now targets a local backend by default.

```bash
python backend_test.py
```

Use `API_BASE_URL` to point it elsewhere:

```bash
set API_BASE_URL=http://localhost:8000
python backend_test.py
```

Recommended next testing additions:

- Backend unit tests for access-control helpers and dependency-cycle detection.
- API integration tests for forbidden project/task access.
- Frontend route/component tests.
- End-to-end tests for login, project creation, task editing, comments, and dependency graph behavior.

## Security Notes

- Public signup always creates a team-member account. Admin and project-manager roles should be assigned through a controlled administrative process.
- Auth is stored in an HTTP-only cookie by default; bearer tokens are still returned for non-browser API clients.
- CORS defaults to local development origins only.
- Production deployments must configure secure cookies, exact CORS origins, strong secrets, TLS, logging, monitoring, backups, and privacy-approved analytics.



