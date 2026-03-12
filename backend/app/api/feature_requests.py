"""
Feature Requests API — Phase 4.
Mounted at /repos (same prefix as other repo routers).
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.base import new_uuid
from backend.app.models.feature_request import FeatureRequest
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.models.user import User
from backend.app.schemas.analysis import FeatureRequestOut, FeatureRequestListResponse
from backend.app.services.feature_pipeline import run_feature_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)


class FeatureRequestCreate(BaseModel):
    description: str


@router.post(
    "/{repo_id}/feature-requests",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=FeatureRequestOut,
)
async def create_feature_request(
    repo_id: str,
    body: FeatureRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a feature request. Creates a FeatureRequest record and runs
    the plan → code → sandbox → PR pipeline in the background.
    Returns the record immediately (status="pending").
    """
    description = body.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="description must not be empty.")

    # Ownership check
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    # Settings check
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

    fr_id = new_uuid()
    # Sanitise description for branch name: keep alphanum + hyphens, cap at 40 chars
    slug = (
        "".join(c if c.isalnum() or c == "-" else "-" for c in description.lower()[:40])
        .strip("-")
    )
    branch_name = f"arma/feat-{fr_id[:8]}-{slug}"[:100]

    fr = FeatureRequest(
        id=fr_id,
        repo_id=repo_id,
        user_id=current_user.id,
        description=description,
        branch_name=branch_name,
        status="pending",
    )
    db.add(fr)
    await db.commit()
    await db.refresh(fr)

    background_tasks.add_task(run_feature_pipeline, fr.id, current_user.id)
    logger.info("[feature] queued %s for repo %s", fr.id, repo_id)

    return fr


@router.get(
    "/{repo_id}/feature-requests",
    response_model=FeatureRequestListResponse,
)
async def list_feature_requests(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all feature requests for a repo, newest first."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    rows = (
        await db.execute(
            select(FeatureRequest)
            .where(FeatureRequest.repo_id == repo_id)
            .order_by(FeatureRequest.created_at.desc())
        )
    ).scalars().all()

    return FeatureRequestListResponse(requests=list(rows), total=len(rows))


@router.get(
    "/{repo_id}/feature-requests/{fr_id}",
    response_model=FeatureRequestOut,
)
async def get_feature_request(
    repo_id: str,
    fr_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single feature request by ID."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    fr = (
        await db.execute(
            select(FeatureRequest).where(
                FeatureRequest.id == fr_id,
                FeatureRequest.repo_id == repo_id,
            )
        )
    ).scalar_one_or_none()
    if not fr:
        raise HTTPException(status_code=404, detail="Feature request not found.")

    return fr
