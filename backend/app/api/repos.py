import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.core.cloner import clone_and_parse_sync
from backend.app.db import get_db
from backend.app.models.base import new_uuid
from backend.app.models.file import RepoFile
from backend.app.models.repo import Repo
from backend.app.models.user import User
from backend.app.schemas.repos import ConnectRepoRequest, RepoFileOut, RepoOut

router = APIRouter()


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
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Run clone + parse in thread pool so it doesn't block the event loop
    background_tasks.add_task(asyncio.to_thread, clone_and_parse_sync, repo.id)
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
