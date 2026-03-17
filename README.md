# ARMA — Autonomous Repository Memory & Actions

> **An AI-powered code guardian that watches your GitHub repos, detects bugs on every push,
> generates fixes with full codebase context, validates them in a sandbox, and opens PRs —
> with no human in the loop.**

---

## The Problem

On June 21, 2025, Cloudflare suffered a global outage that took down major websites for hours.
The root cause: a single bad commit shipping to production undetected. Stories like this happen
every week at teams of every size — a developer pushes code at 11 PM, a silent bug slips past
review, and by morning the damage is done.

Current tools catch some things (linters, CI, code review) but they all require a human to act.
As developers, we've felt this ourselves: pushing what looks like a safe change, only to get a
page at 2 AM.

**ARMA was built to close that loop automatically.** Push code → ARMA detects the bug → ARMA
generates a fix → sandbox validates → PR raised. No human needed, no downtime.

---


## What Is Built

ARMA is a full-stack web application across **4 shipped phases**:

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Auth + Shell (register/login, JWT, settings) | ✅ Done |
| 1 | GitHub + Repo Intelligence (clone, parse, embed, graph) | ✅ Done |
| 2 | Push → Detect Issues (webhooks, LLM analysis, issue tracking) | ✅ Done |
| 3 | Detect → Fix → PR (AI patch generation, sandbox, GitHub PRs) | ✅ Done |
| 4 | Feature Request → Plan → Code → PR (natural-language feature dev) | ✅ Done |

---

## Architecture

```
Browser (Next.js 15 — App Router, Tailwind CSS)
    │
    │  REST + JSON
    ▼
FastAPI (Python 3.12, async)
    │
    ├── PostgreSQL 16 + pgvector ── users, repos, files, symbols,
    │                               commits, issues, pr_jobs,
    │                               feature_requests, embeddings
    │
    ├── Neo4j 5 ─────────────────── knowledge graph
    │                               (DEFINES, CALLS, IMPORTS,
    │                                CO_CHANGES edges)
    │
    └── Background asyncio tasks ── poller, pipelines, webhooks
```

### Triple-Database Design

Most projects use a single database. ARMA intentionally uses **three**, each chosen for what
it does best:

| Database | Role | Why |
|----------|------|-----|
| **PostgreSQL 16** | Core relational store — users, repos, issues, PR jobs | Proven, ACID, foreign keys |
| **pgvector** (PostgreSQL extension) | Semantic code search — 768-dim embeddings of every file chunk | Enables "find code similar to this concept" queries |
| **Neo4j 5** | Knowledge graph — which functions call which, which files change together | Graph traversal for root-cause analysis and impact scoring |

When ARMA analyzes a diff, it doesn't just look at the changed lines. It queries the graph to
find all callers of modified functions, queries the vector store for semantically similar past
bugs, and combines this into a richly-contextualised prompt. The result: fewer false positives,
higher-quality fixes.

---

## Key Features

### 1. Webhook-Driven Live Analysis
Connect a repo and register a GitHub webhook. Every `push` event triggers ARMA to:
- Detect which files changed
- Fetch the diff
- Run an LLM analysis (GPT-4o or any OpenAI-compatible model)
- Store detected issues with severity, type, file, and line number

### 2. Context-Aware Issue Detection
Before calling the LLM, ARMA enriches the prompt with:
- Semantic search results (similar code chunks from the vector store)
- Knowledge graph neighbors (functions that call or are called by the changed code)
- Recent commit history on the file

### 3. Auto-Fix Pipeline
When an issue is detected (or you click "Fix"):
```
Issue found
    → generate_fix (LLM patches the file)
    → run_sandbox (detect pytest/npm test/make, run tests)
    → push_fix_branch (git branch + commit + push)
    → create_github_pr (opens PR with full context body)
    → poller checks merge/close status every 60 s
```

### 4. Feature Request Pipeline
Describe a feature in plain English:
```
"Add rate limiting to the /api/search endpoint"
    → generate_plan (which files to change and how)
    → generate_code (write the actual code for each file)
    → run_sandbox (validate tests still pass)
    → push branch + open PR with full plan description
```

### 5. Semantic Code Search
Search any connected repo with natural language. Queries are embedded and matched against the
pgvector store, returning the most relevant code chunks with file and line references.

### 6. Repo Health Dashboard
Per-repo health metrics: issue counts by severity, fix success rate, PR merge rate, commit
frequency, and code complexity trends.

### 7. Commit Intelligence
ARMA tracks every commit, identifies bug-fix commits using word-boundary regex matching, and
builds an evolution graph of how the codebase changes over time.

---

## Tech Stack

### Backend
- **FastAPI** (Python 3.12) — async REST API
- **SQLAlchemy 2.0** (async) + **asyncpg** — ORM and DB driver
- **Alembic** — database migrations
- **pgvector** — vector similarity search in PostgreSQL
- **neo4j** Python driver — knowledge graph queries
- **openai** Python SDK — LLM calls (GPT-4o, or any compatible endpoint)
- **cryptography (Fernet)** — encrypt GitHub PATs and API keys at rest
- **python-jose** — JWT token generation and verification
- **bcrypt** — password hashing

### Frontend
- **Next.js 15** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS**
- **js-cookie** — JWT storage

### Infrastructure
- **PostgreSQL 16** with pgvector extension
- **Neo4j 5** with APOC plugins
- **Docker + Docker Compose** — single-command local deployment

---

## Project Structure

```
arma/
├── backend/
│   └── app/
│       ├── api/            # FastAPI route handlers
│       │   ├── auth.py         register, login, refresh, me
│       │   ├── repos.py        connect, list, delete, reindex
│       │   ├── analysis.py     trigger LLM analysis
│       │   ├── issues.py       list / get issues
│       │   ├── pr_jobs.py      auto-fix jobs (create, list, get)
│       │   ├── feature_requests.py  feature pipeline
│       │   ├── webhooks.py     GitHub push webhook receiver
│       │   ├── search.py       semantic vector search
│       │   ├── commits.py      commit history
│       │   ├── health.py       repo health metrics
│       │   ├── dashboard.py    aggregate stats
│       │   ├── github.py       list user GitHub repos
│       │   └── settings.py     API keys, model config
│       ├── core/           # Low-level utilities
│       │   ├── cloner.py       git clone + file parsing
│       │   ├── parser.py       language-aware symbol extraction
│       │   ├── git_ops.py      commit history, diff extraction
│       │   └── security.py     JWT helpers, password hashing
│       ├── models/         # SQLAlchemy ORM models
│       ├── schemas/        # Pydantic request/response models
│       └── services/       # Business logic
│           ├── analysis.py     LLM-powered issue detection
│           ├── fixer.py        LLM-powered patch generation
│           ├── planner.py      two-shot feature planning
│           ├── coder.py        feature code generation
│           ├── fix_pipeline.py end-to-end fix orchestrator
│           ├── feature_pipeline.py  end-to-end feature orchestrator
│           ├── sandbox.py      test runner integration
│           ├── vectors.py      embedding storage + search
│           ├── graph.py        Neo4j graph builder
│           ├── git_push.py     branch push + GitHub PR creation
│           ├── poller.py       background PR status polling
│           ├── github.py       GitHub REST API client
│           └── encryption.py   Fernet encrypt/decrypt
├── frontend/
│   └── src/
│       ├── app/            # Next.js App Router pages
│       │   ├── login/
│       │   ├── register/
│       │   └── dashboard/
│       │       ├── settings/
│       │       └── repos/
│       │           └── [id]/
│       │               ├── commits/
│       │               ├── features/
│       │               ├── files/
│       │               ├── fixes/
│       │               ├── health/
│       │               ├── issues/
│       │               └── search/
│       ├── components/
│       │   ├── auth-guard.tsx
│       │   └── sidebar.tsx
│       └── lib/
│           ├── api.ts      typed API client
│           └── auth.ts     JWT helpers
├── alembic/                # DB migration scripts
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## API Reference

All endpoints are prefixed with the FastAPI base URL (default `http://localhost:8000`).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get access + refresh tokens |
| POST | `/auth/refresh` | Rotate tokens |
| GET | `/auth/me` | Current user info |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | Get current settings |
| PUT | `/settings/github-token` | Save encrypted GitHub PAT |
| DELETE | `/settings/github-token` | Remove GitHub PAT |
| PUT | `/settings/openai-key` | Save encrypted OpenAI key |
| PUT | `/settings/model-config` | Set API base, embedding model, analysis model |

### Repositories
| Method | Path | Description |
|--------|------|-------------|
| POST | `/repos` | Connect a GitHub repo (triggers clone + index pipeline) |
| GET | `/repos` | List connected repos |
| GET | `/repos/{id}` | Get repo details + status |
| DELETE | `/repos/{id}` | Disconnect and delete repo |
| GET | `/repos/{id}/files` | List indexed files |
| POST | `/repos/{id}/reindex` | Re-run full pipeline |
| POST | `/repos/{id}/analyze` | Trigger fresh LLM analysis |

### Issues, Fixes, Features
| Method | Path | Description |
|--------|------|-------------|
| GET | `/repos/{id}/issues` | List detected issues |
| POST | `/repos/{id}/issues/{issue_id}/fix` | Kick off auto-fix pipeline |
| GET | `/repos/{id}/pr-jobs` | List fix jobs |
| GET | `/repos/{id}/pr-jobs/{job_id}` | Get single fix job status |
| POST | `/repos/{id}/feature-requests` | Submit feature request |
| GET | `/repos/{id}/feature-requests` | List feature requests |
| GET | `/repos/{id}/feature-requests/{fr_id}` | Get single feature request |

### Intelligence
| Method | Path | Description |
|--------|------|-------------|
| GET | `/repos/{id}/search?q=...` | Semantic vector search |
| GET | `/repos/{id}/commits` | Commit history |
| GET | `/repos/{id}/health` | Repo health metrics |
| GET | `/dashboard` | Aggregate stats across all repos |
| POST | `/webhooks/{repo_id}` | GitHub push webhook (HMAC-SHA256 verified) |

---

## Setup & Installation

### Prerequisites
- Docker and Docker Compose
- A GitHub account with a Personal Access Token (PAT) scoped to `repo`
- An OpenAI API key (or any OpenAI-compatible endpoint: Ollama, LocalAI, vLLM, etc.)

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/arma.git
cd arma
cp .env.example .env
```

Edit `.env`:

```env
ARMA_SECRET_KEY=your-random-32-char-secret-here
ARMA_ENCRYPTION_KEY=           # leave empty for dev (auto-derived from secret_key)
ARMA_CORS_ORIGINS=http://localhost:3000
ARMA_ENV=development
```

### 2. Start the backend

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector on port `5432`
- **Neo4j 5** on ports `7474` (browser) and `7687` (bolt)
- **FastAPI** on port `8000` (runs `alembic upgrade head` on startup)

### 3. Start the frontend

```bash
cd frontend
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:3000`.

### 4. First-time setup in UI

1. Register an account at `/register`
2. Go to **Settings** and add your GitHub PAT and OpenAI key
3. Optionally configure a custom API base (for Ollama, LocalAI, etc.)
4. Go to **Repos** → **Connect Repository**
5. Pick a GitHub repo — ARMA clones it, parses all files, generates embeddings, and builds
   the knowledge graph (status will show: `cloning` → `parsing` → `indexing` → `ready`)
6. Register a webhook in your GitHub repo settings pointing to
   `http://YOUR_SERVER:8000/webhooks/{repo_id}` with your webhook secret

### 5. Using a local LLM (Ollama)

```env
# In Settings UI or .env
OPENAI_API_BASE=http://localhost:11434/v1
ANALYSIS_MODEL=codestral:latest
EMBEDDING_MODEL=nomic-embed-text
```

---

## Security Model

| Concern | Implementation |
|---------|---------------|
| Passwords | bcrypt-hashed, never stored in plaintext |
| JWT tokens | HS256, short-lived access (60 min) + long-lived refresh (30 days) |
| GitHub PAT | Fernet-encrypted at rest in PostgreSQL |
| OpenAI key | Fernet-encrypted at rest in PostgreSQL |
| Webhook signatures | HMAC-SHA256 verified on every incoming webhook |
| Repo ownership | Every API call verifies `repo.user_id == current_user.id` |

---

## Pipelines in Detail

### Fix Pipeline (`fix_pipeline.py`)
```
pending
  → generating   generate_fix() — LLM patches the changed file(s)
  → sandboxing   run_sandbox()  — detects test runner, runs tests
  → pushing      push_fix_branch() — commits + pushes to remote
  → pr_opened    create_github_pr() — opens PR with context body
     [polled every 60 s]
  → merged | failed
```

### Feature Pipeline (`feature_pipeline.py`)
```
pending
  → planning     generate_plan()  — LLM decides which files to create/edit
  → coding       generate_code()  — LLM writes the actual code
  [files written to disk]
  → sandboxing   run_sandbox()    — runs the test suite
  → pushing      push_fix_branch() — commits + pushes branch
  → pr_opened    create_github_pr() — opens PR with plan summary
```

### Repo Indexing Pipeline (on connect / reindex)
```
clone_and_parse_sync()
  → git clone into repos/{id}/
  → parse all source files (Python, JS, TS, Go, Rust, Java, ...)
  → extract symbols (functions, classes, methods) with line numbers
embed_repo()
  → chunk each file
  → embed via OpenAI-compatible embedding model
  → store in PostgreSQL pgvector table
build_repo_graph()
  → build Neo4j graph: File nodes, Symbol nodes
  → DEFINES, CALLS, IMPORTS edges
build_co_change_graph()
  → scan commit history
  → create CO_CHANGES edges between files that change together
```

---

## Roadmap & Planned Upgrades

Lessons from building ARMA (and prior projects) that we want to bring in next:

### Security Hardening
- [ ] JWT cookies with `HttpOnly` + `Secure` + `SameSite=Strict` flags (BUG-19)
- [ ] Strong default `SECRET_KEY` enforcement — refuse to start with the dev default in prod
- [ ] GitHub token passed via `Authorization` header in clone URLs, not embedded in URL (prevents leaking in process list / logs)

### Reliability
- [ ] Replace `asyncio.BackgroundTasks` with **Celery + Redis** for durable job queues
  — currently a server restart kills in-flight pipelines
- [ ] Proper **Docker sandbox isolation** — run tests inside a fresh container, not on the host
- [ ] Idempotent webhook handling — deduplicate events by delivery ID
- [ ] Optimistic lock on repo analysis — prevent two concurrent analysis runs from overwriting issues

### Intelligence
- [ ] **Multi-file patch support** — current fixer patches one file; extend to coordinated
  multi-file changes using the planner's file list
- [ ] **Re-ranking** — use the co-change graph to re-rank which issues to fix first (highest
  blast radius = fix first)
- [ ] **Diff-aware embeddings** — embed only changed chunks on push rather than full re-index
- [ ] **Confidence scoring** — LLM self-rates fix confidence; low-confidence fixes get a human
  review request added to the PR body

### Developer Experience
- [ ] **Real-time status via WebSocket** — replace frontend polling with push notifications
- [ ] **Slack / Discord notifications** — post issue detections and PR links to team channels
- [ ] **GitHub App** instead of PAT — zero-config repo connection via OAuth installation
- [ ] **Web-based settings for embedding dimensions** — currently requires env var change

### Scalability
- [ ] **Neo4j connection pooling** — current driver is created per-request (BUG-07)
- [ ] **Horizontal worker scaling** — Celery workers can scale independently of the API
- [ ] **Incremental graph updates** — only update graph nodes for files that changed
- [ ] **Multi-tenant isolation** — separate embedding namespaces per user

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes and test
4. Open a PR — ARMA might even review its own fix PRs

---

## License

MIT
