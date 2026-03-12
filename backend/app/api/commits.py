"""
Commits API — list commit history and per-file change hotspots.
Mounted at /repos.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.commit import Commit, CommitFile
from backend.app.models.repo import Repo
from backend.app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


class CommitOut(BaseModel):
    id: str
    hash: str
    author_name: str | None
    author_email: str | None
    committed_at: datetime | None
    message: str | None
    is_bug_fix: bool
    additions: int
    deletions: int
    files_changed: int

    model_config = {"from_attributes": True}


class CommitListResponse(BaseModel):
    commits: list[CommitOut]
    total: int


class HotspotOut(BaseModel):
    file_path: str
    churn: int          # total additions + deletions across all commits
    commit_count: int   # how many commits touched this file


class HotspotResponse(BaseModel):
    hotspots: list[HotspotOut]


@router.get("/{repo_id}/commits", response_model=CommitListResponse)
async def list_commits(
    repo_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated commit history for a repo, newest first."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    total = (
        await db.execute(
            select(func.count(Commit.id)).where(Commit.repo_id == repo_id)
        )
    ).scalar() or 0

    commits = (
        await db.execute(
            select(Commit)
            .where(Commit.repo_id == repo_id)
            .order_by(Commit.committed_at.desc().nullslast())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return CommitListResponse(
        commits=[CommitOut.model_validate(c) for c in commits],
        total=total,
    )


@router.get("/{repo_id}/commits/hotspots", response_model=HotspotResponse)
async def file_hotspots(
    repo_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return files ranked by total change volume (churn) across all commits."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    rows = (
        await db.execute(
            select(
                CommitFile.file_path,
                func.sum(CommitFile.additions + CommitFile.deletions).label("churn"),
                func.count(CommitFile.id).label("commit_count"),
            )
            .join(Commit, Commit.id == CommitFile.commit_id)
            .where(Commit.repo_id == repo_id)
            .group_by(CommitFile.file_path)
            .order_by(func.sum(CommitFile.additions + CommitFile.deletions).desc())
            .limit(limit)
        )
    ).all()

    return HotspotResponse(
        hotspots=[
            HotspotOut(file_path=r.file_path, churn=int(r.churn or 0), commit_count=int(r.commit_count or 0))
            for r in rows
        ]
    )
