"""
Analysis API — trigger GPT-4o code review and retrieve issues.
Mounted at /repos (same prefix as repos router).
"""
import asyncio
import logging
from pathlib import Path

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, delete, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db, AsyncSessionLocal
from backend.app.models.base import new_uuid
from backend.app.models.commit import Commit, CommitFile
from backend.app.models.file import RepoFile
from backend.app.models.issue import Issue
from backend.app.models.repo import Repo
from backend.app.models.settings import UserSettings
from backend.app.models.user import User
from backend.app.schemas.analysis import IssueListResponse, IssueOut, IssuePatchRequest
from backend.app.services.analysis import analyze_repo, EXT_LANG, ANALYZABLE_LANGUAGES, SKIP_DIRS, MAX_FILES, MAX_FILE_BYTES
from backend.app.services.encryption import decrypt

router = APIRouter()


async def _run_analysis(repo_id: str, user_id: str, file_paths: list[str] | None = None) -> None:
    """Background task: rank repo files by commit churn, batch-analyze with LLM."""
    try:
        async with AsyncSessionLocal() as db:
            us = (
                await db.execute(
                    select(UserSettings).where(UserSettings.user_id == user_id)
                )
            ).scalar_one_or_none()
            if not us or not us.openai_token_encrypted:
                log.warning("_run_analysis: no settings/key for user %s", user_id)
                return

            openai_key = decrypt(us.openai_token_encrypted)
            api_base = us.openai_api_base
            model = us.analysis_model
            repo_dir = Path("repos") / repo_id
            log.info("_run_analysis: repo=%s api_base=%s model=%s dir_exists=%s",
                     repo_id, api_base, model, repo_dir.exists())

            if not repo_dir.exists():
                log.error("_run_analysis: repo dir missing: %s", repo_dir)
                return

            # If caller gave explicit file paths, skip ranking
            if file_paths is not None:
                ranked_paths = file_paths
            else:
                # --- Rank files by commit churn (uses existing DB data, no LLM) ---
                # Churn = how many commits touched each file
                churn_rows = (
                    await db.execute(
                        select(CommitFile.file_path, func.count(CommitFile.id).label("churn"))
                        .join(Commit, CommitFile.commit_id == Commit.id)
                        .where(Commit.repo_id == repo_id)
                        .group_by(CommitFile.file_path)
                    )
                ).all()
                churn_map: dict[str, int] = {row.file_path: row.churn for row in churn_rows}

                # All code files under the repo dir that are small enough
                all_files = [
                    p for p in repo_dir.rglob("*")
                    if p.is_file()
                    and EXT_LANG.get(p.suffix.lower()) in ANALYZABLE_LANGUAGES
                    and p.stat().st_size <= MAX_FILE_BYTES
                    and not any(
                        part in SKIP_DIRS or part.startswith(".")
                        for part in p.relative_to(repo_dir).parts[:-1]
                    )
                ]

                # Score: churn*3 + 1 so all files get a baseline score
                def _score(p: Path) -> int:
                    rel = str(p.relative_to(repo_dir)).replace("\\", "/")
                    return churn_map.get(rel, 0) * 3 + 1

                all_files.sort(key=_score, reverse=True)
                top_files = all_files[:MAX_FILES]
                ranked_paths = [
                    str(p.relative_to(repo_dir)).replace("\\", "/") for p in top_files
                ]
                log.info("_run_analysis: selected %d files (top by churn)", len(ranked_paths))
                if ranked_paths:
                    log.info("_run_analysis: top files: %s", ranked_paths[:5])

            run_id = new_uuid()
            raw_issues = await analyze_repo(
                openai_key, repo_dir, ranked_paths, api_base=api_base, model=model
            )
            log.info("_run_analysis: found %d raw issues total", len(raw_issues))

            await db.execute(delete(Issue).where(Issue.repo_id == repo_id, Issue.status == "open"))

            # Maps used when LLM puts issue_type value in severity field
            _ISSUE_TYPE_TO_SEVERITY = {
                "bug": "error", "security": "error",
                "performance": "warning", "style": "info", "other": "info",
            }
            _VALID_SEVERITIES = {"info", "warning", "error", "critical"}

            for raw in raw_issues:
                severity = raw.get("severity", "warning")
                if severity not in _VALID_SEVERITIES:
                    severity = _ISSUE_TYPE_TO_SEVERITY.get(severity, "warning")
                issue_type = raw.get("issue_type", "other")
                title = str(raw.get("title", ""))[:255]
                description = str(raw.get("description", ""))
                file_path = str(raw.get("file_path", ""))[:1000]
                line_number = raw.get("line_number")
                if isinstance(line_number, (int, float)):
                    line_number = int(line_number)
                else:
                    line_number = None

                db.add(Issue(
                    id=new_uuid(),
                    repo_id=repo_id,
                    run_id=run_id,
                    file_path=file_path,
                    line_number=line_number,
                    severity=severity,
                    issue_type=issue_type,
                    title=title,
                    description=description,
                    status="open",
                ))

            await db.commit()
    except Exception as exc:
        log.exception("_run_analysis failed for repo %s: %s", repo_id, exc)


@router.post("/{repo_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def trigger_analysis(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a GPT-4o code review for the repo. Returns 202 immediately."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
    if repo.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository is not ready for analysis (status: {repo.status}).",
        )

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

    background_tasks.add_task(_run_analysis, repo_id, current_user.id, None)
    return {"detail": "Analysis started.", "repo_id": repo_id}


@router.get("/{repo_id}/issues", response_model=IssueListResponse)
async def list_issues(
    repo_id: str,
    issue_status: str | None = None,
    severity: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all issues for a repo, optionally filtered by status or severity."""
    # Ownership check
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    query = select(Issue).where(Issue.repo_id == repo_id)
    if issue_status:
        query = query.where(Issue.status == issue_status)
    if severity:
        query = query.where(Issue.severity == severity)
    query = query.order_by(
        case(
            (Issue.severity == "critical", 0),
            (Issue.severity == "error",    1),
            (Issue.severity == "warning",  2),
            (Issue.severity == "info",     3),
            else_=4,
        ),
        Issue.file_path,
    )

    issues = (await db.execute(query)).scalars().all()

    # Severity counts (always across all open issues regardless of filter)
    all_open = (
        await db.execute(
            select(Issue.severity, func.count(Issue.id))
            .where(Issue.repo_id == repo_id, Issue.status == "open")
            .group_by(Issue.severity)
        )
    ).all()
    by_severity = {row[0]: row[1] for row in all_open}

    return IssueListResponse(
        issues=[IssueOut.model_validate(i) for i in issues],
        total=len(issues),
        by_severity=by_severity,
    )


@router.patch("/{repo_id}/issues/{issue_id}", response_model=IssueOut)
async def update_issue(
    repo_id: str,
    issue_id: str,
    body: IssuePatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss or reopen an issue."""
    if body.status not in ("open", "dismissed"):
        raise HTTPException(status_code=422, detail="status must be 'open' or 'dismissed'")

    # Ownership check via repo
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

    issue.status = body.status
    await db.commit()
    await db.refresh(issue)
    return IssueOut.model_validate(issue)
