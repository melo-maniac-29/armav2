"""
Auto-fix pipeline orchestrator.

run_fix_pipeline(job_id) drives the full Phase 3 flow:
  pending → generating → sandboxing → pushing → pr_opened | failed
"""
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import AsyncSessionLocal
from backend.app.models.base import new_uuid
from backend.app.models.issue import Issue
from backend.app.models.pr_job import PrJob
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt
from backend.app.services.fixer import generate_fix
from backend.app.services.git_push import create_github_pr, get_default_branch, push_fix_branch
from backend.app.services.sandbox import run_sandbox

logger = logging.getLogger(__name__)

MAX_SANDBOX_LOG = 20_000  # chars stored in DB


async def run_fix_pipeline(job_id: str, user_id: str) -> None:
    """
    Full auto-fix pipeline for a single PrJob.
    All status updates are persisted so the frontend can poll.
    """
    async with AsyncSessionLocal() as db:
        job = await _get_job(job_id, db)
        if not job:
            logger.error("[fix] job %s not found", job_id)
            return

        issue = await _get_issue(job.issue_id, db)
        repo = await _get_repo(job.repo_id, db)
        us = await _get_settings(user_id, db)

        if not issue or not repo or not us:
            await _fail(job, "Missing issue, repo, or user settings.", db)
            return

        repo_dir = Path("repos") / repo.id
        if not repo_dir.exists():
            await _fail(job, f"Cloned repo directory not found: {repo_dir}", db)
            return

        # ── Step 1: Generate fix ──────────────────────────────────────────
        await _set_status(job, "generating", db)
        try:
            fixed_content, explanation = await generate_fix(issue, user_id, repo.id, db)
        except Exception as exc:
            await _fail(job, f"Fix generation failed: {exc}", db)
            return

        # Persist patch text (first 50 KB)
        job.patch_text = fixed_content[:50_000]
        await db.commit()

        # Write fixed file to disk (still on the default branch at this point)
        file_abs = repo_dir / issue.file_path
        try:
            file_abs.write_text(fixed_content, encoding="utf-8")
        except Exception as exc:
            await _fail(job, f"Cannot write fixed file: {exc}", db)
            return

        # ── Step 2: Sandbox ──────────────────────────────────────────────
        await _set_status(job, "sandboxing", db)
        try:
            passed, sandbox_log = await run_sandbox(repo_dir)
        except Exception as exc:
            passed = False
            sandbox_log = f"Sandbox error: {exc}"

        job.sandbox_log = sandbox_log[:MAX_SANDBOX_LOG]
        job.sandbox_result = "passed" if passed else "failed"
        await db.commit()

        if not passed:
            await _fail(job, "Tests failed after applying the fix. See sandbox log.", db)
            return

        # ── Step 3: Push branch + open PR ────────────────────────────────
        await _set_status(job, "pushing", db)

        github_token = _get_github_token(us)
        if not github_token:
            await _fail(job, "GitHub token not configured.", db)
            return

        branch_name = job.branch_name  # set when job was created
        commit_msg = f"fix({issue.issue_type}): {issue.title}\n\nAuto-fix by ARMA\n\n{explanation}"
        pr_title = f"fix: {issue.title}"
        pr_body = (
            f"## Auto-fix by ARMA\n\n"
            f"**Issue:** {issue.title}\n"
            f"**File:** `{issue.file_path}`"
            + (f" (line {issue.line_number})" if issue.line_number else "")
            + f"\n**Severity:** {issue.severity} / {issue.issue_type}\n\n"
            f"### Description\n{issue.description}\n\n"
            f"### Fix applied\n{explanation}\n\n"
            f"---\n*This PR was opened automatically by [ARMA](https://github.com/arma-dev/arma).*"
        )

        try:
            base_branch = await get_default_branch(github_token, repo.full_name)
            push_fix_branch(
                repo_dir=repo_dir,
                branch_name=branch_name,
                changed_files=[issue.file_path],
                commit_message=commit_msg,
                github_token=github_token,
                remote_url=repo.clone_url,
            )
            pr_number, pr_url = await create_github_pr(
                token=github_token,
                full_name=repo.full_name,
                head_branch=branch_name,
                base_branch=base_branch,
                title=pr_title,
                body=pr_body,
            )
        except Exception as exc:
            await _fail(job, f"Push/PR failed: {exc}", db)
            return

        # ── Done ─────────────────────────────────────────────────────────
        job.status = "pr_opened"
        job.github_pr_number = pr_number
        job.github_pr_url = pr_url
        # Mark the issue as fixed
        issue.status = "fixed"
        await db.commit()
        logger.info("[fix] job %s → PR #%d %s", job_id, pr_number, pr_url)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_job(job_id: str, db: AsyncSession) -> PrJob | None:
    return (await db.execute(select(PrJob).where(PrJob.id == job_id))).scalar_one_or_none()


async def _get_issue(issue_id: str, db: AsyncSession) -> Issue | None:
    return (await db.execute(select(Issue).where(Issue.id == issue_id))).scalar_one_or_none()


async def _get_repo(repo_id: str, db: AsyncSession) -> Repo | None:
    return (await db.execute(select(Repo).where(Repo.id == repo_id))).scalar_one_or_none()


async def _get_settings(user_id: str, db: AsyncSession) -> UserSettings | None:
    return (
        await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    ).scalar_one_or_none()


async def _set_status(job: PrJob, status: str, db: AsyncSession) -> None:
    job.status = status
    await db.commit()
    logger.info("[fix] job %s → %s", job.id, status)


async def _fail(job: PrJob, reason: str, db: AsyncSession) -> None:
    job.status = "failed"
    job.error_msg = reason[:2000]
    await db.commit()
    logger.warning("[fix] job %s failed: %s", job.id, reason)


def _get_github_token(us: UserSettings) -> str | None:
    if not us.github_token_encrypted:
        return None
    return decrypt(us.github_token_encrypted)
