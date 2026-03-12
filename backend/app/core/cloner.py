"""
Clone a GitHub repo and parse its file tree into the database.
Runs in a thread pool (asyncio.to_thread) — all DB operations are synchronous.
"""
import shutil
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.models.base import new_uuid
from backend.app.models.file import RepoFile
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt

# ── language detection ────────────────────────────────────────────────────────
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".next", "dist", "build",
    "vendor", ".venv", "venv", "env", "target", ".gradle", "coverage",
    ".cache", "out", ".turbo",
}

EXT_LANG: dict[str, str] = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".c": "C", ".cpp": "C++",
    ".cc": "C++", ".cxx": "C++", ".h": "C Header", ".hpp": "C++ Header",
    ".cs": "C#", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".kts": "Kotlin", ".scala": "Scala",
    ".r": "R", ".sql": "SQL", ".html": "HTML", ".css": "CSS",
    ".scss": "SCSS", ".sass": "SCSS", ".vue": "Vue", ".svelte": "Svelte",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".md": "Markdown", ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
    ".tf": "Terraform", ".bicep": "Bicep",
}

MAX_FILE_BYTES = 1_048_576  # skip files > 1 MB


def _detect_language(p: Path) -> str | None:
    name = p.name.lower()
    if name == "dockerfile":
        return "Dockerfile"
    if name in ("makefile", "gnumakefile"):
        return "Makefile"
    return EXT_LANG.get(p.suffix.lower())


# ── main task ─────────────────────────────────────────────────────────────────

def clone_and_parse_sync(repo_id: str) -> None:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
    engine = create_engine(sync_url, pool_pre_ping=True)
    clone_path = Path("repos") / repo_id

    def _set_status(session: Session, status: str, error: str | None = None) -> None:
        repo = session.get(Repo, repo_id)
        if repo:
            repo.status = status
            repo.error_msg = error
            session.commit()

    try:
        with Session(engine) as session:
            repo = session.get(Repo, repo_id)
            if not repo:
                return

            # Retrieve encrypted PAT
            us = session.execute(
                select(UserSettings).where(UserSettings.user_id == repo.user_id)
            ).scalar_one_or_none()
            if not us or not us.github_token_encrypted:
                _set_status(session, "error", "No GitHub token configured. Add one in Settings.")
                return

            token = decrypt(us.github_token_encrypted)
            raw_url = repo.clone_url  # e.g. https://github.com/owner/repo.git
            auth_url = (
                raw_url.replace("https://", f"https://{token}@")
                if raw_url.startswith("https://")
                else raw_url
            )

            # ── clone ──────────────────────────────────────────────────────────
            _set_status(session, "cloning")
            if clone_path.exists():
                shutil.rmtree(clone_path)
            clone_path.mkdir(parents=True, exist_ok=True)

            # Try with explicit branch first, fall back to default
            result = subprocess.run(
                ["git", "clone", "--depth=1", "--branch", repo.default_branch,
                 auth_url, str(clone_path)],
                capture_output=True, text=True, timeout=300,
            )
            if result.returncode != 0:
                result = subprocess.run(
                    ["git", "clone", "--depth=1", auth_url, str(clone_path)],
                    capture_output=True, text=True, timeout=300,
                )
            if result.returncode != 0:
                _set_status(session, "error", (result.stderr or "Clone failed")[:500])
                return

            # ── parse ──────────────────────────────────────────────────────────
            _set_status(session, "parsing")

            # Remove stale file records
            session.execute(delete(RepoFile).where(RepoFile.repo_id == repo_id))
            session.flush()

            files: list[RepoFile] = []
            for fp in clone_path.rglob("*"):
                if not fp.is_file():
                    continue
                parts = fp.relative_to(clone_path).parts
                # Skip any path segment that is a ignored dir or hidden
                if any(p in SKIP_DIRS or p.startswith(".") for p in parts[:-1]):
                    continue
                try:
                    size = fp.stat().st_size
                    if size > MAX_FILE_BYTES:
                        continue
                    files.append(RepoFile(
                        id=new_uuid(),
                        repo_id=repo_id,
                        path=str(fp.relative_to(clone_path)).replace("\\", "/"),
                        language=_detect_language(fp),
                        size_bytes=size,
                    ))
                except OSError:
                    continue

            session.add_all(files)
            _set_status(session, "ready")

    except Exception as exc:
        try:
            with Session(engine) as s2:
                _set_status(s2, "error", str(exc)[:500])
        except Exception:
            pass
    finally:
        engine.dispose()
