"""
PR Jobs API — Phase 3 auto-fix endpoints.
Mounted at /repos (same prefix as other repo routers).
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.base import new_uuid
from backend.app.models.issue import Issue
from backend.app.models.pr_job import PrJob
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.models.user import User
from backend.app.schemas.analysis import PrJobListResponse, PrJobOut
from backend.app.services.fix_pipeline import run_fix_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/{repo_id}/issues/{issue_id}/fix",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=PrJobOut,
)
async def create_fix_job(
    repo_id: str,
    issue_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Kick off an auto-fix for an issue.
    Creates a PrJob and runs the pipeline in the background.
    Returns the job immediately (status="pending").
    """
    # Ownership check
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    issue = (
        await db.execute(
            select(Issue).where(Issue.id == issue_id, Issue.repo_id == repo_id)
        )
    ).scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    us = (
        await db.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OpenAI API key not configured. Add one in Settings.",
        )

    short_id = issue_id[:8]
    branch_name = f"arma/fix-{short_id}"

    job = PrJob(
        id=new_uuid(),
        repo_id=repo_id,
        issue_id=issue_id,
        branch_name=branch_name,
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(run_fix_pipeline, job.id, current_user.id)

    logger.info("[fix] created job %s for issue %s", job.id, issue_id)
    return PrJobOut.model_validate(job)


@router.get("/{repo_id}/pr-jobs", response_model=PrJobListResponse)
async def list_pr_jobs(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all auto-fix jobs for a repo, newest first."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    jobs = (
        await db.execute(
            select(PrJob)
            .where(PrJob.repo_id == repo_id)
            .order_by(PrJob.created_at.desc())
        )
    ).scalars().all()

    return PrJobListResponse(
        jobs=[PrJobOut.model_validate(j) for j in jobs],
        total=len(jobs),
    )


@router.get("/{repo_id}/pr-jobs/{job_id}", response_model=PrJobOut)
async def get_pr_job(
    repo_id: str,
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single auto-fix job by ID."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    job = (
        await db.execute(
            select(PrJob).where(PrJob.id == job_id, PrJob.repo_id == repo_id)
        )
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return PrJobOut.model_validate(job)
