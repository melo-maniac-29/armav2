import asyncio
import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.core.cloner import clone_and_parse_sync
from backend.app.db import get_db, AsyncSessionLocal
from backend.app.models.base import new_uuid
from backend.app.models.file import RepoFile
from backend.app.models.repo import Repo
from backend.app.models.symbol import Symbol
from backend.app.models.user import User
from backend.app.schemas.repos import ConnectRepoRequest, RepoFileOut, RepoOut
from backend.app.services.vectors import embed_repo
from backend.app.services.graph import build_repo_graph, build_co_change_graph

router = APIRouter()


async def _full_pipeline(repo_id: str, user_id: str) -> None:
    """
    Background pipeline:
      1. Clone repo + parse files + extract symbols  (sync, in thread)
      2. Generate pgvector embeddings               (async, uses user's LLM API)
      3. Build Neo4j knowledge graph                (async, uses user's Neo4j)
    Steps 2 and 3 are skipped gracefully on error so a missing API key or
    unreachable Neo4j doesn't break the whole clone.
    """
    # Step 1 — blocking clone + parse (must be in thread)
    await asyncio.to_thread(clone_and_parse_sync, repo_id)

    # Step 2 — async embedding (skip if user has no OpenAI key or API unavailable)
    try:
        async with AsyncSessionLocal() as db:
            # Load symbol data for graph building while we have the session
            from sqlalchemy import select as sa_select
            from backend.app.models.file import RepoFile as _RF
            from backend.app.models.symbol import Symbol as _Sym

            files_result = await db.execute(
                sa_select(_RF).where(_RF.repo_id == repo_id)
            )
            files = files_result.scalars().all()
            files_data = [{"path": f.path, "language": f.language or ""} for f in files]

            syms_result = await db.execute(
                sa_select(_Sym).where(_Sym.repo_id == repo_id)
            )
            syms = syms_result.scalars().all()
            symbols_data = [
                {
                    "file_path": s.file_id and next(
                        (f.path for f in files if f.id == s.file_id), ""
                    ) or "",
                    "kind": s.kind,
                    "name": s.name,
                    "calls": s.calls.split(",") if s.calls else [],
                    "imports": s.imports.split(",") if s.imports else [],
                }
                for s in syms
            ]

            await embed_repo(repo_id, user_id, db)
    except Exception as e:
        logger.warning("[pipeline] embed_repo failed for %s: %s", repo_id, e)  # non-fatal

    # Step 3 — async Neo4j graph build + commit co-changes
    try:
        async with AsyncSessionLocal() as db:
            await build_repo_graph(repo_id, symbols_data, files_data)
            await build_co_change_graph(repo_id, db)
    except Exception as e:
        logger.warning("[pipeline] graph build failed for %s: %s", repo_id, e)  # non-fatal


@router.post("", response_model=RepoOut, status_code=status.HTTP_201_CREATED)
async def connect_repo(
    body: ConnectRepoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Prevent duplicate connections
    existing = (
        await db.execute(
            select(Repo).where(
                Repo.user_id == current_user.id,
                Repo.github_id == body.github_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository already connected.",
        )

    repo = Repo(
        id=new_uuid(),
        user_id=current_user.id,
        github_id=body.github_id,
        full_name=body.full_name,
        clone_url=body.clone_url,
        default_branch=body.default_branch,
        status="pending",
        webhook_secret=secrets.token_hex(32),
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Run full pipeline in background: clone → embed → graph
    background_tasks.add_task(_full_pipeline, repo.id, current_user.id)
    return repo


@router.get("", response_model=list[RepoOut])
async def list_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Repo)
        .where(Repo.user_id == current_user.id)
        .order_by(Repo.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{repo_id}", response_model=RepoOut)
async def get_repo(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repo(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    await db.delete(repo)
    await db.commit()


@router.get("/{repo_id}/files", response_model=list[RepoFileOut])
async def list_repo_files(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership first
    owner = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Repository not found")

    files = await db.execute(
        select(RepoFile).where(RepoFile.repo_id == repo_id).order_by(RepoFile.path)
    )
    return files.scalars().all()


@router.post("/{repo_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_repo(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run the full pipeline (clone → parse → embed → graph) for a repo."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    background_tasks.add_task(_full_pipeline, repo_id, current_user.id)
    return {"detail": "Re-indexing started"}
