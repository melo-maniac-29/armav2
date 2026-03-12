"""
Feature planning service.

Given a feature description + repo context, asks the LLM to produce a
plan: which files to create/modify and what to do in each.

Returns list[dict] with keys: file_path, action ("create"|"modify"), description.
"""
import json

from openai import AsyncOpenAI
from sqlalchemy import select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.file import RepoFile
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt
from backend.app.services.vectors import _embed_batch


PLANNER_SYSTEM = """\
You are a senior software architect. You will be given:
1. A FEATURE REQUEST in natural language
2. A list of FILES in the codebase (with language hints)
3. Top RELEVANT code snippets found via semantic search

Your task:
- Plan the minimal set of file changes needed to implement the feature.
- For each change, specify:
  - "file_path": relative path (existing file OR new file path to create)
  - "action": one of "create" or "modify"
  - "description": one or two sentences describing what to implement / change

Return ONLY a valid JSON object with a single key "plan" whose value is an array.
Each element must have the three keys: file_path, action, description.
Example: {"plan": [{"file_path": "src/auth.py", "action": "modify", "description": "Add rate limiting."}]}"""


async def generate_plan(
    description: str,
    user_id: str,
    repo_id: str,
    db: AsyncSession,
) -> list[dict]:
    """
    Generate an implementation plan for the given feature description.

    Returns:
        list of dicts: [{file_path, action, description}, ...]
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

    # Get file list from DB (cap at 300 to avoid context overflow)
    files = (
        await db.execute(select(RepoFile).where(RepoFile.repo_id == repo_id))
    ).scalars().all()
    file_list_text = "\n".join(
        f"  {f.path}" + (f"  ({f.language})" if f.language else "")
        for f in files[:300]
    )

    # Semantic search for relevant snippets
    context_snippets = await _get_plan_context(description, repo_id, db, us, client)
    context_block = ""
    if context_snippets:
        context_block = "\n\nRelevant code:\n" + "\n\n".join(
            f"// {name}\n{text[:2000]}" for name, text in context_snippets
        )

    user_message = (
        f"Feature request: {description}\n\n"
        f"Codebase files:\n{file_list_text}"
        f"{context_block}"
    )

    resp = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PLANNER_SYSTEM},
            {"role": "user", "content": user_message},
        ],
        max_tokens=2000,
        temperature=0,
    )

    raw = resp.choices[0].message.content
    data = json.loads(raw)

    # Accept {"plan": [...]} or direct list
    if isinstance(data, list):
        plan = data
    else:
        plan = data.get("plan", data.get("changes", data.get("files", [])))
        if not isinstance(plan, list):
            raise ValueError(f"LLM returned unexpected plan format: {data}")

    # Validate each item
    validated: list[dict] = []
    for item in plan:
        if not isinstance(item, dict):
            continue
        fp = str(item.get("file_path", "")).strip()
        action = str(item.get("action", "modify")).strip().lower()
        desc = str(item.get("description", "")).strip()
        if fp and action in ("create", "modify"):
            validated.append({"file_path": fp, "action": action, "description": desc})

    if not validated:
        raise ValueError("LLM returned an empty or invalid plan.")

    return validated


async def _get_plan_context(
    query: str,
    repo_id: str,
    db: AsyncSession,
    us: UserSettings,
    client: AsyncOpenAI,
    limit: int = 5,
) -> list[tuple[str, str]]:
    """Return the top-N most semantically relevant code chunks."""
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
                    ORDER BY embedding <=> CAST(:vec AS vector)
                    LIMIT :lim
                    """
                ),
                {"repo_id": repo_id, "vec": str(q_vec), "lim": limit},
            )
        ).fetchall()
        return [(r[0], r[1]) for r in rows]
    except Exception:
        return []
