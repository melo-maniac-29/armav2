"""
Code generation service — Phase 4.

Given a plan (list of {file_path, action, description}) and the overall
feature description, generates the actual new file content for each
planned change using the LLM + semantic context.

Returns dict[str, str]: file_path → new content.
"""
import json
from pathlib import Path

from openai import AsyncOpenAI
from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt
from backend.app.services.graph import get_related_files
from backend.app.services.vectors import _embed_batch


CODER_SYSTEM = """\
You are an expert software engineer implementing a specific code change.
You will be given:
1. The FEATURE being implemented (overall description)
2. The TASK for this specific file (what to implement or change)
3. The CURRENT content of the file (empty string if creating a new file)
4. Optional CONTEXT snippets from related files for style / pattern reference

Your task:
- Produce the complete new content of the file.
- Match the existing code style, naming conventions, and patterns.
- For "modify" tasks: preserve all existing functionality; only add what is needed.
- For "create" tasks: write a complete, self-contained file.
- Return a JSON object with exactly two keys:
  - "new_content": the complete file content as a string
  - "explanation": one sentence describing what changed
Return ONLY valid JSON. Do not include any text outside the JSON object."""


async def generate_code(
    plan: list[dict],
    feature_description: str,
    user_id: str,
    repo_id: str,
    db: AsyncSession,
) -> dict[str, str]:
    """
    For each item in `plan`, generate the new file content via LLM.

    Returns:
        dict mapping file_path → new_content string.
    Raises:
        ValueError on settings / LLM failure.
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

    repo_dir = Path("repos") / repo_id
    patches: dict[str, str] = {}

    for item in plan:
        file_path: str = item["file_path"]
        action: str = item["action"]
        task_desc: str = item["description"]

        # Read current file content
        file_abs = repo_dir / file_path
        try:
            current_content = file_abs.read_text(errors="replace") if file_abs.exists() else ""
        except Exception:
            current_content = ""

        # Fetch vector context (semantic similarity)
        vector_ctx = await _get_code_context(task_desc, repo_id, file_path, db, us, client)

        # Fetch graph context (IMPORTS / CO_CHANGES_WITH neighbors from Neo4j)
        graph_ctx = await _get_graph_context(repo_id, file_path, repo_dir)

        # Merge: graph first (structural), then vector (semantic), deduplicate
        seen: set[str] = {file_path}
        context: list[tuple[str, str]] = []
        for name, text in graph_ctx + vector_ctx:
            if name not in seen:
                seen.add(name)
                context.append((name, text))

        context_block = ""
        if context:
            context_block = "\n\nRelated code for reference:\n" + "\n\n".join(
                f"// {name}\n{text[:1500]}" for name, text in context
            )

        user_msg = (
            f"Feature: {feature_description}\n\n"
            f"Task ({action}) for `{file_path}`: {task_desc}\n\n"
            f"Current file content:\n```\n{current_content[:20000]}\n```"
            f"{context_block}"
        )

        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": CODER_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=4000,
            temperature=0,
        )

        raw = resp.choices[0].message.content
        if not raw or not raw.strip():
            raise ValueError("LLM returned empty response. Check your API key / chat proxy.")
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        new_content = data.get("new_content", "")

        if not new_content or not new_content.strip():
            raise ValueError(f"LLM returned empty new_content for {file_path}")

        patches[file_path] = new_content

    return patches


async def _get_code_context(
    query: str,
    repo_id: str,
    exclude_path: str,
    db: AsyncSession,
    us: UserSettings,
    client: AsyncOpenAI,
    limit: int = 3,
) -> list[tuple[str, str]]:
    """Return semantically similar code chunks, excluding the target file."""
    try:
        embed_model = us.embedding_model or "text-embedding-ada-002"
        vecs = await _embed_batch([query], client, embed_model)
        if not vecs:
            return []
        q_vec = vecs[0]

        rows = (
            await db.execute(
                sa_text(
                    """
                    SELECT chunk_name, chunk_text
                    FROM code_embeddings
                    WHERE repo_id = :repo_id
                      AND chunk_name NOT LIKE :excl
                    ORDER BY embedding <=> CAST(:vec AS vector)
                    LIMIT :lim
                    """
                ),
                {
                    "repo_id": repo_id,
                    "excl": f"{exclude_path}%",
                    "vec": str(q_vec),
                    "lim": limit,
                },
            )
        ).fetchall()
        return [(r[0], r[1]) for r in rows]
    except Exception:
        return []


async def _get_graph_context(
    repo_id: str,
    file_path: str,
    repo_dir: Path,
) -> list[tuple[str, str]]:
    """Return up to 3 (name, text) pairs from graph-adjacent files (IMPORTS + CO_CHANGES_WITH)."""
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
