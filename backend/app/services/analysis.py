"""
GPT-4o code analysis service.
Reads cloned repo files and returns structured issue dicts.
"""
import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

log = logging.getLogger(__name__)

# Languages worth sending to GPT-4o for code review
ANALYZABLE_LANGUAGES = {
    "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java",
    "C", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
    "Shell", "SQL",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".next", "dist", "build",
    "vendor", ".venv", "venv", "env", "target", ".gradle", "coverage",
    ".cache", "out", ".turbo",
}

EXT_LANG: dict[str, str] = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".go": "Go",
    ".rs": "Rust", ".java": "Java", ".c": "C", ".cpp": "C++",
    ".cc": "C++", ".cxx": "C++", ".cs": "C#", ".rb": "Ruby",
    ".php": "PHP", ".swift": "Swift", ".kt": "Kotlin", ".kts": "Kotlin",
    ".scala": "Scala", ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
    ".sql": "SQL",
}

MAX_FILE_BYTES = 8_000  # 8 KB per file
MAX_FILES = 18          # top-ranked files (6 batches of 3 = 6 LLM calls)
BATCH_SIZE = 3          # files per LLM call

SYSTEM_PROMPT = """You are an expert code reviewer. Analyze the provided source files for issues.

For each file find:
- Bugs (logic errors, null pointer risks, off-by-one errors, unhandled exceptions)
- Security vulnerabilities (injection, hardcoded secrets, improper input validation)
- Performance issues (inefficient algorithms, N+1 queries, unnecessary work)
- Code quality issues (dead code, unclear logic, poor error handling)

Return JSON: {"files": [{"path": "<path>", "issues": [...]}, ...]}
Each issue: line_number (int|null), severity (info|warning|error|critical),
issue_type (bug|security|performance|style|other), title (<=80 chars), description.
Return {"files": []} if nothing found. Return ONLY valid JSON."""


async def analyze_repo(
    openai_key: str,
    repo_dir: Path,
    file_paths: list[str] | None = None,
    api_base: str | None = None,
    model: str | None = None,
) -> list[dict]:
    """
    Analyze code files in repo_dir using the configured LLM.

    Args:
        openai_key: User's API key (works with OpenAI and local compatible servers).
        repo_dir: Path to the cloned repository root.
        file_paths: If provided, only analyze these paths (relative to repo_dir).
                    If None, analyze all supported code files.
        api_base: Base URL for the API (e.g. http://localhost:5005/v1).
                  Defaults to OpenAI's endpoint.
        model: Model name to use. Defaults to gpt-4o.

    Returns:
        List of raw issue dicts with keys: file_path, line_number, severity,
        issue_type, title, description.
    """
    client_kwargs: dict = {"api_key": openai_key}
    if api_base:
        client_kwargs["base_url"] = api_base
    client = AsyncOpenAI(**client_kwargs)
    chat_model = model or "gpt-4o"

    # Build (rel_path, lang, content) tuples
    if file_paths is not None:
        # Caller already ranked/filtered; trust the list
        file_data: list[tuple[str, str, str]] = []
        for fp in file_paths:
            fpath = repo_dir / fp
            if not fpath.exists():
                continue
            lang = EXT_LANG.get(fpath.suffix.lower(), "")
            if lang not in ANALYZABLE_LANGUAGES:
                continue
            try:
                content = fpath.read_text(errors="replace")
            except Exception:
                continue
            if content.strip():
                file_data.append((fp, lang, content))
    else:
        # Fallback: walk disk, filter small code files, sort smallest-first
        candidates = [
            p for p in repo_dir.rglob("*")
            if p.is_file()
            and EXT_LANG.get(p.suffix.lower()) in ANALYZABLE_LANGUAGES
            and p.stat().st_size <= MAX_FILE_BYTES
            and not any(part in SKIP_DIRS or part.startswith(".") for part in p.relative_to(repo_dir).parts[:-1])
        ]
        candidates = sorted(candidates, key=lambda p: p.stat().st_size)[:MAX_FILES]
        file_data = []
        for fpath in candidates:
            lang = EXT_LANG.get(fpath.suffix.lower(), "")
            try:
                content = fpath.read_text(errors="replace")
            except Exception:
                continue
            if content.strip():
                rel = str(fpath.relative_to(repo_dir)).replace("\\", "/")
                file_data.append((rel, lang, content))

    all_issues: list[dict] = []

    # Process in batches of BATCH_SIZE — one LLM call per batch
    for i in range(0, len(file_data), BATCH_SIZE):
        batch = file_data[i : i + BATCH_SIZE]
        parts = []
        for rel_path, lang, content in batch:
            parts.append(f"=== {rel_path} ({lang}) ===\n```{lang.lower()}\n{content}\n```")
        user_content = "\n\n".join(parts)

        try:
            resp = await client.chat.completions.create(
                model=chat_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                max_tokens=3000,
                temperature=0,
            )
            raw_text = (resp.choices[0].message.content or "").strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```", 2)[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
                raw_text = raw_text.rstrip("`").strip()
            data = json.loads(raw_text) if raw_text else {}
            for file_result in (data.get("files", []) if isinstance(data, dict) else []):
                fp = file_result.get("path", "")
                for issue in (file_result.get("issues", []) or []):
                    issue["file_path"] = fp
                    all_issues.append(issue)
            log.info("analysis: batch %d-%d done, issues so far: %d",
                     i, i + len(batch) - 1, len(all_issues))
        except Exception as exc:
            log.warning("analysis: batch %d-%d failed: %s", i, i + len(batch) - 1, exc)
            continue

    return all_issues
