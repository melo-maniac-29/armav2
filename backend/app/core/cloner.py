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
from backend.app.core.git_ops import parse_git_log
from backend.app.core.parser import parse_file
from backend.app.models.base import new_uuid
from backend.app.models.commit import Commit, CommitFile
from backend.app.models.file import RepoFile
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.models.symbol import Symbol
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

# Extensions we'll run parser.parse_file on for symbol extraction
PARSEABLE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx"}


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
                ["git", "clone", "--depth=200", "--branch", repo.default_branch,
                 auth_url, str(clone_path)],
                capture_output=True, text=True, timeout=300,
            )
            if result.returncode != 0:
                result = subprocess.run(
                    ["git", "clone", "--depth=200", auth_url, str(clone_path)],
                    capture_output=True, text=True, timeout=300,
                )
            if result.returncode != 0:
                _set_status(session, "error", (result.stderr or "Clone failed")[:500])
                return

            # ── parse ──────────────────────────────────────────────────────────
            _set_status(session, "parsing")

            # Remove stale file records and symbols
            session.execute(delete(Symbol).where(Symbol.repo_id == repo_id))
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
            session.flush()  # so file IDs are available for FK references

            # ── symbol extraction ──────────────────────────────────────────────
            path_to_file_id = {f.path: f.id for f in files}
            symbols: list[Symbol] = []
            for f in files:
                if f.language is None:
                    continue
                fp = clone_path / f.path
                if fp.suffix.lower() not in PARSEABLE_EXTENSIONS:
                    continue
                try:
                    content = fp.read_text(errors="replace")
                except Exception:
                    continue
                if not content.strip():
                    continue

                parsed = parse_file(fp, content)
                for sym in parsed.symbols:
                    symbols.append(Symbol(
                        id=new_uuid(),
                        repo_id=repo_id,
                        file_id=f.id,
                        kind=sym.kind,
                        name=sym.name,
                        start_line=sym.start_line,
                        end_line=sym.end_line,
                        signature=sym.signature,
                        docstring=(sym.docstring or "")[:500] if sym.docstring else None,
                        calls=",".join(sym.calls[:50]) if sym.calls else None,
                        imports=",".join(sym.imports[:50]) if sym.imports else None,
                    ))

            if symbols:
                session.add_all(symbols)

            # ── commit history ─────────────────────────────────────────────────
            _set_status(session, "indexing")

            # Clear stale commit data
            from sqlalchemy import delete as sa_delete
            session.execute(
                sa_delete(CommitFile).where(
                    CommitFile.commit_id.in_(
                        session.scalars(
                            select(Commit.id).where(Commit.repo_id == repo_id)
                        ).all()
                    )
                )
            )
            session.execute(sa_delete(Commit).where(Commit.repo_id == repo_id))
            session.flush()

            commit_records = parse_git_log(clone_path, max_commits=500)
            for cr in commit_records:
                commit_row = Commit(
                    id=new_uuid(),
                    repo_id=repo_id,
                    hash=cr.hash,
                    author_name=cr.author_name,
                    author_email=cr.author_email,
                    committed_at=cr.committed_at,
                    message=cr.message,
                    is_bug_fix=cr.is_bug_fix,
                    additions=cr.additions,
                    deletions=cr.deletions,
                    files_changed=cr.files_changed,
                )
                session.add(commit_row)
                session.flush()  # get commit_row.id

                for fr in cr.files:
                    session.add(CommitFile(
                        id=new_uuid(),
                        commit_id=commit_row.id,
                        file_path=fr.path,
                        change_type=fr.change_type,
                        additions=fr.additions,
                        deletions=fr.deletions,
                    ))

            _set_status(session, "ready")

    except Exception as exc:
        try:
            with Session(engine) as s2:
                _set_status(s2, "error", str(exc)[:500])
        except Exception:
            pass
    finally:
        engine.dispose()
