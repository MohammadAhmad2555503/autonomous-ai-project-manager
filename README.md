# Autonomous AI Project Manager

Full-stack project management MVP with task dependencies, critical-path graphing, analytics, deterministic risk scoring, and AI project summaries.

## Project Type

Full-stack project management and AI insights app

## Why It Stands Out

- Project/task CRUD, role-aware access control, comments, dependencies, and cycle/self-dependency validation.
- Dependency graph visualisation with computed critical-path highlighting.
- Project analytics for task status, overdue work, high-risk work, and team workload.
- Deterministic delay-risk scoring plus AI insight endpoints with a mock fallback when no external system key is configured.

## Tech and Skills

FastAPI, React, MongoDB, Motor, JWT Auth, ReactFlow, Recharts, Tailwind CSS, Risk Scoring, Project Analytics

## Getting Started

~~~powershell
cd backend && python -m venv .venv && .\.venv\Scripts\activate && pip install -r requirements.txt && python seed.py
~~~

~~~powershell
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
~~~

~~~powershell
cd frontend && npm install && npm start
~~~

## GitHub Readiness

- Friendly repository name: autonomous-ai-project-manager
- Prepared on: 2026-08-28 21:35:38 +01:00
- Included files: 87
- Excluded items/directories: 6
- Recommended visibility: private until you manually review everything for public release.

## Data and Runtime Artifacts

Runtime reports, generated folders, local env files, caches, dependencies, and build outputs were excluded.

## Original Documentation

The source README has been preserved at docs/ORIGINAL_README_FROM_SOURCE.md.



