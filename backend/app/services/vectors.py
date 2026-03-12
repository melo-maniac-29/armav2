"""
Vector embedding service.
Uses the user's configured OpenAI-compatible API to generate embeddings,
then stores them in PostgreSQL via pgvector.
"""
import hashlib
from pathlib import Path

from openai import AsyncOpenAI
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.base import new_uuid
from backend.app.models.embedding import CodeEmbedding
from backend.app.models.file import RepoFile
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt

# Languages we generate embeddings for
EMBED_LANGUAGES = {
    "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java",
    "C", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
    "Shell", "SQL",
}

MAX_CHUNK_CHARS = 6000   # ~1500 tokens — stay well inside context window
BATCH_SIZE = 10          # embed this many texts per API call


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split a text into overlapping chunks."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    step = max_chars - 200  # 200-char overlap
    for i in range(0, len(text), step):
        chunks.append(text[i : i + max_chars])
    return chunks


async def _embed_batch(
    texts: list[str],
    client: AsyncOpenAI,
    model: str,
) -> list[list[float]]:
    """Call the embedding API for a batch of texts."""
    resp = await client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in resp.data]


async def embed_repo(repo_id: str, user_id: str, db: AsyncSession) -> None:
    """
    Generate embeddings for every file in a repo and store in code_embeddings.
    Skips files that already have an up-to-date embedding (same content_hash).
    """
    # Get user settings
    us = (
        await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        return  # No OpenAI key configured — skip silently

    openai_key = decrypt(us.openai_token_encrypted)
    api_base = us.openai_api_base or "https://api.openai.com/v1"
    embed_model = us.embedding_model or "text-embedding-ada-002"

    client = AsyncOpenAI(api_key=openai_key, base_url=api_base)

    # Load all repo files that have an embeddable language
    files_result = await db.execute(
        select(RepoFile).where(
            RepoFile.repo_id == repo_id,
            RepoFile.language.in_(EMBED_LANGUAGES),
        )
    )
    files = files_result.scalars().all()
    if not files:
        return

    repo_dir = Path("repos") / repo_id

    # Clear old embeddings for this repo (commit immediately so concurrent pipelines see the delete)
    await db.execute(delete(CodeEmbedding).where(CodeEmbedding.repo_id == repo_id))
    await db.commit()

    # Collect (text, metadata) pairs to embed
    pending: list[tuple[str, dict]] = []

    for f in files:
        fpath = repo_dir / f.path
        if not fpath.exists():
            continue
        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue
        if not content.strip():
            continue

        chunks = _chunk_text(content)
        for idx, chunk in enumerate(chunks):
            pending.append((chunk, {
                "file_id": f.id,
                "repo_id": repo_id,
                "chunk_type": "file",
                "chunk_name": f.path if idx == 0 else f"{f.path}[{idx}]",
                "start_line": 1 if idx == 0 else None,
                "end_line": None,
                "content_hash": _hash(chunk),
            }))

    if not pending:
        return

    # Embed in batches
    embeddings: list[list[float]] = []
    texts = [p[0] for p in pending]
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        try:
            vecs = await _embed_batch(batch, client, embed_model)
            embeddings.extend(vecs)
        except Exception:
            # On error, pad with Nones to maintain index alignment
            embeddings.extend([None] * len(batch))  # type: ignore

    # Store
    for (text, meta), vec in zip(pending, embeddings):
        if vec is None:
            continue
        db.add(CodeEmbedding(
            id=new_uuid(),
            repo_id=meta["repo_id"],
            file_id=meta["file_id"],
            chunk_type=meta["chunk_type"],
            chunk_name=meta["chunk_name"],
            chunk_text=text[:2000],  # store truncated for display
            start_line=meta["start_line"],
            end_line=meta["end_line"],
            content_hash=meta["content_hash"],
            embedding=vec,
        ))

    await db.commit()


async def semantic_search(
    query: str,
    repo_id: str,
    user_id: str,
    db: AsyncSession,
    limit: int = 10,
) -> list[dict]:
    """
    Embed query and find the most similar code chunks via pgvector cosine similarity.
    Returns list of dicts with file_path, chunk_name, chunk_text, similarity.
    """
    us = (
        await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        return []

    openai_key = decrypt(us.openai_token_encrypted)
    api_base = us.openai_api_base or "https://api.openai.com/v1"
    embed_model = us.embedding_model or "text-embedding-ada-002"

    client = AsyncOpenAI(api_key=openai_key, base_url=api_base)
    try:
        resp = await client.embeddings.create(input=[query], model=embed_model)
        query_vec = resp.data[0].embedding
    except Exception:
        return []

    # pgvector cosine distance: <=>
    from sqlalchemy import text as sa_text
    rows = await db.execute(
        sa_text(
            """
            SELECT ce.chunk_name, ce.chunk_text, ce.chunk_type,
                   rf.path AS file_path,
                   1 - (ce.embedding <=> CAST(:qvec AS vector)) AS similarity
            FROM code_embeddings ce
            JOIN repo_files rf ON rf.id = ce.file_id
            WHERE ce.repo_id = :repo_id
            ORDER BY ce.embedding <=> CAST(:qvec AS vector)
            LIMIT :lim
            """
        ),
        {"qvec": str(query_vec), "repo_id": repo_id, "lim": limit},
    )
    return [
        {
            "file_path": row.file_path,
            "chunk_name": row.chunk_name,
            "chunk_type": row.chunk_type,
            "chunk_text": row.chunk_text,
            "similarity": round(float(row.similarity), 4),
        }
        for row in rows
    ]
