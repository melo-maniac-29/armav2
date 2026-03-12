"""
GitHub webhook handler.
POST /webhooks/github — receives push events, verifies HMAC-SHA256, triggers analysis.
"""
import hashlib
import hmac
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.analysis import _run_analysis
from backend.app.db import get_db
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt

router = APIRouter()


@router.post("/github", status_code=status.HTTP_204_NO_CONTENT)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive GitHub push events.
    Validates HMAC-SHA256 signature using the per-repo webhook_secret.
    Triggers analysis on changed files only.
    """
    # Read raw body for HMAC verification
    body = await request.body()

    event = request.headers.get("X-GitHub-Event", "")
    if event not in ("push", "ping"):
        return  # Ignore events other than push/ping

    payload = await _parse_json_body(body)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if event == "ping":
        return  # Acknowledge ping without processing

    # Extract full_name
    repo_data = payload.get("repository", {})
    full_name = repo_data.get("full_name", "")
    github_id = repo_data.get("id")
    if not full_name or not github_id:
        raise HTTPException(status_code=400, detail="Missing repository info in payload")

    # Find matching repos (could be multiple users with same repo — check all)
    result = await db.execute(
        select(Repo).where(Repo.github_id == github_id)
    )
    repos = result.scalars().all()
    if not repos:
        return  # No connected repos for this github_id

    # Find the repo whose webhook_secret matches the signature
    sig_header = request.headers.get("X-Hub-Signature-256", "")
    matched_repo = None
    for repo in repos:
        if not repo.webhook_secret:
            continue
        expected = "sha256=" + hmac.new(
            repo.webhook_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(sig_header, expected):
            matched_repo = repo
            break

    if matched_repo is None:
        raise HTTPException(status_code=401, detail="Signature verification failed")

    if matched_repo.status != "ready":
        return  # Repo not ready — skip analysis

    # Check user has OpenAI key
    us = (
        await db.execute(
            select(UserSettings).where(UserSettings.user_id == matched_repo.user_id)
        )
    ).scalar_one_or_none()
    if not us or not us.openai_token_encrypted:
        return  # No OpenAI key — skip analysis silently

    # Collect changed file paths from push commits
    changed: set[str] = set()
    for commit in payload.get("commits", []):
        changed.update(commit.get("added", []))
        changed.update(commit.get("modified", []))

    # Only analyze files that exist in the clone
    repo_dir = Path("repos") / matched_repo.id
    existing = [p for p in changed if (repo_dir / p).exists()] if changed else None

    background_tasks.add_task(_run_analysis, matched_repo.id, matched_repo.user_id, existing)


async def _parse_json_body(body: bytes) -> dict | None:
    import json
    try:
        return json.loads(body)
    except Exception:
        return None
