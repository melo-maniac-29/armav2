"""
Fix generation service.

Given an Issue, reads the affected file, fetches semantic context from
code_embeddings, and asks the configured LLM to produce a corrected file.
Returns the fixed file content (full text) and a brief explanation.
"""
import json
from pathlib import Path

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.embedding import CodeEmbedding
from backend.app.models.issue import Issue
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt
from backend.app.services.graph import get_related_files
from backend.app.services.vectors import _embed_batch


SYSTEM_PROMPT = """\
You are an expert software engineer fixing a specific code issue.
You will be given:
1. The ISSUE to fix (file path, line number, description)
2. The FULL content of the affected source file
3. Optional CONTEXT snippets from related files for reference

Your task:
- Produce a corrected version of the affected file that fixes ONLY the reported issue.
- Do NOT refactor unrelated code, change variable names, or add unnecessary comments.
- Return a JSON object with exactly two keys:
  - "fixed_content": the complete corrected file content as a string
  - "explanation": one or two sentences describing the change made

Return ONLY valid JSON. Do not include any text outside the JSON object."""


async def generate_fix(
    issue: Issue,
    user_id: str,
    repo_id: str,
    db: AsyncSession,
) -> tuple[str, str]:
    """
    Generate a fixed version of the file affected by `issue`.

    Returns:
        (fixed_content, explanation)
    Raises:
        ValueError if settings are missing or LLM call fails.
    """
    us = (
        await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        raise ValueError("OpenAI API key not configured.")

    api_key = decrypt(us.openai_token_encrypted)
    api_base = us.openai_api_base or "https://api.openai.com/v1"
    model = us.analysis_model or "gpt-4o"

    client = AsyncOpenAI(api_key=api_key, base_url=api_base)

    # Read the affected file from disk
    repo_dir = Path("repos") / repo_id
    file_abs = repo_dir / issue.file_path
    if not file_abs.exists():
        raise ValueError(f"File not found on disk: {issue.file_path}")

    try:
        file_content = file_abs.read_text(errors="replace")
    except Exception as exc:
        raise ValueError(f"Cannot read file: {exc}") from exc

    # Fetch semantic context: top-3 related chunks (excluding the affected file)
    context_snippets = await _get_context(
        issue.description, user_id, repo_id, issue.file_path, db, us, client
    )

    # Fetch graph context: files related via IMPORTS / CO_CHANGES_WITH edges
    graph_snippets = await _get_graph_context(repo_id, issue.file_path, repo_dir)

    # Merge: graph first (structural), then vector (semantic), deduplicate by name
    seen: set[str] = {issue.file_path}
    merged: list[tuple[str, str]] = []
    for name, text in graph_snippets + context_snippets:
        if name not in seen:
            seen.add(name)
            merged.append((name, text))

    # Build user message
    issue_block = (
        f"File: {issue.file_path}\n"
        f"Line: {issue.line_number or 'unknown'}\n"
        f"Severity: {issue.severity}\n"
        f"Type: {issue.issue_type}\n"
        f"Title: {issue.title}\n"
        f"Description: {issue.description}"
    )

    context_block = ""
    if merged:
        context_block = "\n\n--- Related context ---\n" + "\n\n".join(
            f"// {name}\n{text[:1500]}" for name, text in merged
        )

    user_message = (
        f"Issue to fix:\n{issue_block}\n\n"
        f"Affected file ({issue.file_path}):\n```\n{file_content[:30000]}\n```"
        f"{context_block}"
    )

    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4000,
        temperature=0,
    )

    raw = resp.choices[0].message.content
    if not raw or not raw.strip():
        raise ValueError("LLM returned empty response. Check your API key / chat proxy.")
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    data = json.loads(text)
    fixed_content = data.get("fixed_content", "")
    explanation = data.get("explanation", "")

    if not fixed_content or not fixed_content.strip():
        raise ValueError("LLM returned empty fixed_content.")

    return fixed_content, explanation


async def _get_context(
    query: str,
    user_id: str,
    repo_id: str,
    exclude_path: str,
    db: AsyncSession,
    us: UserSettings,
    client: AsyncOpenAI,
) -> list[tuple[str, str]]:
    """
    Return up to 3 (chunk_name, chunk_text) pairs semantically similar to query,
    excluding chunks from the affected file itself.
    """
    try:
        embed_model = us.embedding_model or "text-embedding-ada-002"
        vecs = await _embed_batch([query], client, embed_model)
        if not vecs:
            return []
        q_vec = vecs[0]

        # pgvector cosine similarity via raw SQL
        from sqlalchemy import text as sa_text
        rows = (await db.execute(
            sa_text(
                """
                SELECT chunk_name, chunk_text
                FROM code_embeddings
                WHERE repo_id = :repo_id
                  AND chunk_name NOT LIKE :excl
                ORDER BY embedding <=> CAST(:vec AS vector)
                LIMIT 3
                """
            ),
            {
                "repo_id": repo_id,
                "excl": f"{exclude_path}%",
                "vec": str(q_vec),
            },
        )).fetchall()
        return [(r[0], r[1]) for r in rows]
    except Exception:
        return []


async def _get_graph_context(
    repo_id: str,
    file_path: str,
    repo_dir: Path,
) -> list[tuple[str, str]]:
    """
    Use Neo4j to find files related via IMPORTS / CO_CHANGES_WITH edges,
    then read their content from disk. Returns up to 3 (name, text) pairs.
    """
    try:
        related_paths = await get_related_files(repo_id, file_path, depth=2)
    except Exception:
        return []

    snippets: list[tuple[str, str]] = []
    for rel_path in related_paths[:3]:
        abs_path = repo_dir / rel_path
        if abs_path.exists():
            try:
                text = abs_path.read_text(errors="replace")
                snippets.append((rel_path, text))
            except Exception:
                continue
    return snippets
