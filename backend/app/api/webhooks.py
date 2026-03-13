"""
GitHub webhook handler.
POST /webhooks/github — receives push and pull_request events, verifies HMAC-SHA256.
"""
import hashlib
import hmac
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.analysis import _run_analysis
from backend.app.db import get_db
from backend.app.models.feature_request import FeatureRequest
from backend.app.models.pr_job import PrJob
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt

router = APIRouter()


async def _verify_signature(repos: list, sig_header: str, body: bytes) -> "Repo | None":
    """Return the first repo whose webhook_secret matches the HMAC-SHA256 signature."""
    for repo in repos:
        if not repo.webhook_secret:
            continue
        expected = "sha256=" + hmac.HMAC(
            repo.webhook_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(sig_header, expected):
            return repo
    return None


@router.post("/github", status_code=status.HTTP_204_NO_CONTENT)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive GitHub webhook events.
    - push: triggers analysis on changed files.
    - pull_request closed+merged: advances PrJob/FeatureRequest status to 'merged'.
    """
    body = await request.body()
    event = request.headers.get("X-GitHub-Event", "")

    if event == "ping":
        return

    if event not in ("push", "pull_request"):
        return  # Ignore all other events

    payload = await _parse_json_body(body)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    repo_data = payload.get("repository", {})
    full_name = repo_data.get("full_name", "")
    github_id = repo_data.get("id")
    if not full_name or not github_id:
        raise HTTPException(status_code=400, detail="Missing repository info in payload")

    # Find matching repos (could be multiple users with same repo — check all)
    result = await db.execute(select(Repo).where(Repo.github_id == github_id))
    repos = result.scalars().all()
    if not repos:
        return

    sig_header = request.headers.get("X-Hub-Signature-256", "")
    matched_repo = await _verify_signature(repos, sig_header, body)
    if matched_repo is None:
        raise HTTPException(status_code=401, detail="Signature verification failed")

    if event == "pull_request":
        await _handle_pr_merged(payload, matched_repo, db)
        return

    # --- push event ---
    if matched_repo.status != "ready":
        return

    us = (
        await db.execute(
            select(UserSettings).where(UserSettings.user_id == matched_repo.user_id)
        )
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        return

    changed: set[str] = set()
    for commit in payload.get("commits", []):
        changed.update(commit.get("added", []))
        changed.update(commit.get("modified", []))

    repo_dir = Path("repos") / matched_repo.id
    existing = [p for p in changed if (repo_dir / p).exists()] if changed else None

    background_tasks.add_task(_run_analysis, matched_repo.id, matched_repo.user_id, existing, True)


async def _handle_pr_merged(payload: dict, repo: "Repo", db: AsyncSession) -> None:
    """Set PrJob or FeatureRequest status to 'merged' when GitHub reports a PR was merged."""
    action = payload.get("action", "")
    pr_data = payload.get("pull_request", {})
    if action != "closed" or not pr_data.get("merged", False):
        return  # Only care about merged PRs

    pr_number = pr_data.get("number")
    if not pr_number:
        return

    # Try PrJob first
    pr_job = (
        await db.execute(
            select(PrJob).where(
                PrJob.repo_id == repo.id,
                PrJob.github_pr_number == pr_number,
                PrJob.status == "pr_opened",
            )
        )
    ).scalar_one_or_none()
    if pr_job:
        pr_job.status = "merged"
        await db.commit()
        return

    # Try FeatureRequest
    fr = (
        await db.execute(
            select(FeatureRequest).where(
                FeatureRequest.repo_id == repo.id,
                FeatureRequest.github_pr_number == pr_number,
                FeatureRequest.status == "pr_opened",
            )
        )
    ).scalar_one_or_none()
    if fr:
        fr.status = "merged"
        await db.commit()


async def _parse_json_body(body: bytes) -> dict | None:
    import json
    try:
        return json.loads(body)
    except Exception:
        return None
