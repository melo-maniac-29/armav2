# ARMA v3 — Master Plan

> **Autonomous Repository Memory & Actions**
> ARMA watches your codebase, detects bugs on every push, generates fixes with full context,
> validates them in a sandbox, and opens PRs — with no human in the loop.

---

## Core Value Propositions

### 1. Push → Detect → Fix → PR
Developer pushes code → ARMA detects bugs (built-in + user-defined checks) → generates a fix
using full codebase context → validates in Docker sandbox → raises a PR. No human needed.

### 2. Feature Request → Plan → Code → PR
Developer describes a feature in natural language → ARMA plans the implementation using real
codebase patterns → writes code matching team style → validates in sandbox → raises a PR.

---

## Architecture

```
Browser
  └── Next.js 15 (App Router, Tailwind CSS)
       └── FastAPI (Python 3.12)
            ├── PostgreSQL 16 + pgvector   — users, repos, files, commits, issues, PRs
            ├── Neo4j 5                    — knowledge graph (CALLS, IMPORTS, CO_CHANGES)
            ├── Redis 7                    — Celery broker
            └── Celery Workers             — background analysis, fix gen, PR creation
```

---

## Build Phases (one at a time, verify before next)

### Phase 0 — Auth + Shell  ✅ BUILDING NOW
Goal: Users can register, log in, and see a dashboard. Nothing else.

Backend:
- User model (id, email, hashed_password, created_at)
- POST /auth/register  — create account
- POST /auth/login     — returns JWT (access + refresh)
- GET  /auth/me        — returns current user (protected)
- JWT middleware on all non-auth routes
- Docker: FastAPI + PostgreSQL only

Frontend:
- /login  — email/password form
- /register — email/password form
- /dashboard — protected shell with sidebar (shows username)
- JWT stored in httpOnly cookie
- Redirect to /login if not authenticated

Verify gate: register → login → see dashboard → logout → blocked at dashboard

---

### Phase 1 — GitHub + Repo Intelligence
Goal: Users connect GitHub repos; ARMA parses and remembers the codebase.

Backend:
- Settings page — user stores GitHub PAT (Fernet-encrypted in DB)
- GET /github/repos    — list user's repos via GitHub API
- POST /repos          — connect a repo (triggers Celery: clone → parse → embed → graph)
- GET /repos           — list connected repos
- GET /repos/{id}      — repo detail + status
- GET /repos/{id}/files — list all parsed files
- Webhooks: auto-update on push (HMAC-verified)
- Docker: add Redis + Neo4j + Celery

Frontend:
- Settings page: enter/update GitHub PAT
- Repos list page: browse GitHub repos, connect button
- Repo detail page: status, files, commits

Verify gate: enter PAT → list GitHub repos → connect one → status "ready" → browse files

---

### Phase 2 — Push → Detect Issues
Goal: Every push is analyzed by GPT-4o; issues shown in UI.

Backend:
- Webhook handler gets diff of changed files
- GPT-4o call: diff + context → structured issues (file, line, severity, description, type)
- issues table: store all detected issues
- GET /repos/{id}/issues — list issues

Frontend:
- Issues tab per repo: list with severity badges, file links, dismiss button

Verify gate: push bad code → issue appears in UI within 30s

---

### Phase 3 — Detect → Fix → PR  (the whole point)
Goal: ARMA autonomously fixes issues and opens GitHub PRs.

Backend:
- For each issue: GPT-4o with full codebase context → generates patch
- Apply patch to new branch in cloned repo
- Sandbox: detect test framework (pytest / npm test / make test) → docker run --rm
- If tests pass: push branch → GitHub API creates PR with description
- pr_jobs table: track status (pending → sandboxing → pr_opened / failed)
- GET /repos/{id}/pr-jobs — list all auto-fix PRs

Frontend:
- "Auto Fix" button on each issue
- PR jobs list with GitHub PR links
- Progress indicator (queued → sandboxing → opened / failed)

Verify gate: click "Auto Fix" → real GitHub PR appears on the repo

---

### Phase 4 — Feature Request → Plan → Code → PR
Goal: Developer describes a feature; ARMA implements and ships it.

Backend:
- POST /repos/{id}/feature-requests — user submits natural language description
- pgvector search finds relevant files for context
- GPT-4o two-shot: plan (which files, what changes) → then code generation
- Apply changes to branch, run sandbox, create PR
- feature_requests table: track all requests and their PR status

Frontend:
- "Request Feature" button on repo page
- Free-text input + submit
- Progress view showing plan → coding → sandboxing → PR opened

Verify gate: type "add rate limiting" → GitHub PR appears implementing it

---

## Data Model

### Phase 0 tables
- users (id UUID PK, email UNIQUE, hashed_password, created_at, updated_at)

### Phase 1 tables (added)
- user_settings (user_id FK, github_token_encrypted, embedding_provider, openai_api_key_encrypted)
- repositories (id, user_id FK, name owner/repo, clone_url, default_branch, webhook_id, webhook_secret, last_analyzed_commit, status, created_at, updated_at)
- file_records (id, repo_id FK, path, language, content_hash, line_count, complexity)
- symbol_records (id, file_id FK, name, kind, start_line, end_line, signature, docstring)
- commits (id, repo_id FK, hash, author_name, author_email, committed_at, message, is_bug_fix, additions, deletions, files_changed)
- commit_files (id, commit_id FK, file_path, change_type, additions, deletions)
- evolution_metrics (id, file_id FK UNIQUE, change_frequency, bug_frequency, author_count, risk_score)
- code_embeddings (id, file_id FK, chunk_name, chunk_type, chunk_text, start_line, end_line, content_hash, embedding Vector(768))

### Phase 2 tables (added)
- issues (id, repo_id FK, commit_hash, file_path, line_number, severity, issue_type, title, description, status [open/dismissed/fixed], created_at)

### Phase 3 tables (added)
- pr_jobs (id, issue_id FK, repo_id FK, branch_name, patch_text, sandbox_status, sandbox_log, github_pr_number, github_pr_url, status, created_at, updated_at)

### Phase 4 tables (added)
- feature_requests (id, repo_id FK, user_id FK, description, plan_json, status, github_pr_url, created_at)

---

## Three-Database Architecture

### PostgreSQL + pgvector — The Facts
All structured data: users, repos, files, commits, issues, PRs.
pgvector extension stores 768-dim code embeddings for semantic search.

### Neo4j — The Relationships
Knowledge graph built from code parsing:
- File -[:DEFINES]-> Symbol
- Symbol -[:CALLS]-> Symbol
- File -[:IMPORTS]-> Module
- File -[:CO_CHANGES_WITH]-> File (weighted by commit co-occurrence)

Powers Phase 3 fix generation: "if we fix line 42 of auth.py, what else may be affected?"

### Redis — The Queue
Celery broker for all background tasks: clone, parse, analyze, fix, sandbox, PR creation.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| API auth | JWT Bearer token on all endpoints (except /auth/* and /webhooks/*) |
| GitHub PAT | Fernet-encrypted, stored per user, never logged |
| OpenAI key | Fernet-encrypted per user (user brings their own key) |
| Webhooks | HMAC-SHA256 with per-repo secret |
| Passwords | bcrypt (cost factor 12) |
| CORS | Explicit origin whitelist in production |

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| FastAPI | 0.115 | HTTP server |
| SQLAlchemy[asyncio] | 2.0 | Async ORM |
| asyncpg | 0.30 | PostgreSQL driver |
| alembic | 1.15 | Migrations |
| pgvector | 0.3 | Vector type |
| neo4j | 5.28 | Graph driver |
| celery | 5.5 | Task queue |
| redis | 5.3 | Broker |
| httpx | 0.28 | Async HTTP (GitHub API) |
| python-jose | 3.3 | JWT |
| passlib[bcrypt] | 1.7 | Password hashing |
| cryptography | 44 | Fernet encryption |
| tree-sitter-language-pack | 0.6 | Code parsing (20 langs) |
| pydriller | 2.9 | Git history mining |
| openai | 1.x | GPT-4o API |
| structlog | 25 | Structured logging |

### Frontend
| Package | Purpose |
|---------|---------|
| Next.js 15 | App Router, React 19 |
| Tailwind CSS 4 | Styling |
| shadcn/ui | Component library |
| TanStack Query | Data fetching + caching |
| js-cookie | Cookie management |

---

## Implementation Status

### ✅ Phase 0 — In Progress
### ⬜ Phase 1 — Not Started
### ⬜ Phase 2 — Not Started
### ⬜ Phase 3 — Not Started
### ⬜ Phase 4 — Not Started
