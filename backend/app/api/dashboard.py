"""Dashboard summary endpoint — aggregate stats across all repos."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.issue import Issue
from backend.app.models.pr_job import PrJob
from backend.app.models.repo import Repo
from backend.app.models.user import User

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregate stats: repo count, open issues, PRs opened."""
    repos_total = (
        await db.execute(
            select(func.count(Repo.id)).where(Repo.user_id == current_user.id)
        )
    ).scalar() or 0

    repo_ids = list(
        (
            await db.execute(
                select(Repo.id).where(Repo.user_id == current_user.id)
            )
        ).scalars()
    )

    if repo_ids:
        issues_open = (
            await db.execute(
                select(func.count(Issue.id)).where(
                    Issue.repo_id.in_(repo_ids),
                    Issue.status == "open",
                )
            )
        ).scalar() or 0

        prs_opened = (
            await db.execute(
                select(func.count(PrJob.id)).where(
                    PrJob.repo_id.in_(repo_ids),
                    PrJob.status == "pr_opened",
                )
            )
        ).scalar() or 0
    else:
        issues_open = 0
        prs_opened = 0

    return {
        "repos_total": repos_total,
        "issues_open": issues_open,
        "prs_opened": prs_opened,
    }
