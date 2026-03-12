"""
Semantic search API — pgvector cosine similarity over code embeddings.
Mounted at /repos (same prefix as repos router).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.repo import Repo
from backend.app.models.user import User
from backend.app.schemas.search import SearchResponse
from backend.app.services.vectors import semantic_search

router = APIRouter()


@router.get("/{repo_id}/search", response_model=list[SearchResponse])
async def search_repo(
    repo_id: str,
    q: str = Query(..., min_length=1, max_length=500, description="Natural language search query"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Semantic code search using pgvector embeddings.
    Requires that the repo has been indexed (status=ready) and embeddings generated.
    """
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    results = await semantic_search(q, repo_id, current_user.id, db, limit=limit)
    return results
