"""
GPT-4o code analysis service.
Reads cloned repo files and returns structured issue dicts.
"""
import json
from pathlib import Path

from openai import AsyncOpenAI

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

MAX_FILE_BYTES = 40_000   # 40 KB per file — prevents huge context windows
MAX_FILES = 100           # cap to avoid runaway API costs

SYSTEM_PROMPT = """You are an expert code reviewer. Analyze the provided source file for:
- Bugs (logic errors, null pointer risks, off-by-one errors, unhandled exceptions)
- Security vulnerabilities (injection, hardcoded secrets, improper input validation, insecure dependencies)
- Performance issues (inefficient algorithms, N+1 queries, unnecessary work)
- Code quality issues (dead code, unclear logic, poor error handling)

Return a JSON object with an "issues" array. Each element must have:
- "line_number": integer or null (approximate line where the issue occurs)
- "severity": "info" | "warning" | "error" | "critical"
- "issue_type": "bug" | "security" | "performance" | "style" | "other"
- "title": string — one-line summary, max 80 characters
- "description": string — clear explanation, impact, and suggested fix

Return {"issues": []} if no meaningful issues are found.
Return ONLY valid JSON. Do not include any text outside the JSON object."""


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

    if file_paths is not None:
        candidates = [repo_dir / p for p in file_paths]
    else:
        candidates = [
            p for p in repo_dir.rglob("*")
            if p.is_file()
            and EXT_LANG.get(p.suffix.lower()) in ANALYZABLE_LANGUAGES
            and not any(part in SKIP_DIRS or part.startswith(".") for part in p.relative_to(repo_dir).parts[:-1])
        ]

    # Limit and sort deterministically
    candidates = sorted(candidates)[:MAX_FILES]

    all_issues: list[dict] = []

    for fpath in candidates:
        if not fpath.exists():
            continue

        lang = EXT_LANG.get(fpath.suffix.lower(), "")
        if lang not in ANALYZABLE_LANGUAGES:
            continue

        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue

        if not content.strip():
            continue

        if len(content.encode()) > MAX_FILE_BYTES:
            content = content[:MAX_FILE_BYTES] + "\n\n[...truncated due to size...]"

        rel_path = str(fpath.relative_to(repo_dir)).replace("\\", "/")

        try:
            resp = await client.chat.completions.create(
                model=chat_model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"File: {rel_path}\nLanguage: {lang}\n\n```{lang.lower()}\n{content}\n```",
                    },
                ],
                max_tokens=2000,
                temperature=0,
            )
            data = json.loads(resp.choices[0].message.content)
            raw_issues = data.get("issues", []) if isinstance(data, dict) else []
            for issue in raw_issues:
                issue["file_path"] = rel_path
            all_issues.extend(raw_issues)
        except Exception:
            # Skip files that cause errors — don't fail the whole run
            continue

    return all_issues
