"""
Health & Evolution API — repository health dashboard.
Aggregates commit velocity, bug-fix rate, file hotspots, issue risk, and
knowledge-graph coverage into a single response.

Mounted at /repos.
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.commit import Commit, CommitFile
from backend.app.models.embedding import CodeEmbedding
from backend.app.models.issue import Issue
from backend.app.models.repo import Repo
from backend.app.models.symbol import Symbol
from backend.app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


class WeeklyBucket(BaseModel):
    week: str           # ISO date of Monday
    commits: int
    bug_fixes: int


class Hotspot(BaseModel):
    file_path: str
    churn: int
    commit_count: int
    open_issues: int    # open issues targeting this file


class HealthResponse(BaseModel):
    # Commit stats
    total_commits: int
    bug_fix_commits: int
    bug_fix_rate: float             # 0-1
    weekly_velocity: list[WeeklyBucket]  # last 8 weeks

    # Issue risk
    open_issues: int
    critical_issues: int
    risk_score: int                  # 0-100

    # Hotspots (top 10 files by churn)
    hotspots: list[Hotspot]

    # Coverage
    symbols_indexed: int
    embeddings_indexed: int
    files_indexed: int


@router.get("/{repo_id}/health", response_model=HealthResponse)
async def repo_health(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return health and evolution metrics for a repo."""
    repo = (
        await db.execute(
            select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")

    # ── Commit stats ─────────────────────────────────────────────────────
    total_commits = (
        await db.execute(
            select(func.count(Commit.id)).where(Commit.repo_id == repo_id)
        )
    ).scalar() or 0

    bug_fix_commits = (
        await db.execute(
            select(func.count(Commit.id)).where(
                Commit.repo_id == repo_id, Commit.is_bug_fix == True  # noqa: E712
            )
        )
    ).scalar() or 0

    bug_fix_rate = round(bug_fix_commits / total_commits, 3) if total_commits else 0.0

    # ── Weekly velocity (last 8 weeks) ───────────────────────────────────
    now = datetime.now(timezone.utc)
    weekly: list[WeeklyBucket] = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(days=now.weekday(), weeks=i)
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)

        week_commits = (
            await db.execute(
                select(func.count(Commit.id)).where(
                    Commit.repo_id == repo_id,
                    Commit.committed_at >= week_start,
                    Commit.committed_at < week_end,
                )
            )
        ).scalar() or 0

        week_bug_fixes = (
            await db.execute(
                select(func.count(Commit.id)).where(
                    Commit.repo_id == repo_id,
                    Commit.committed_at >= week_start,
                    Commit.committed_at < week_end,
                    Commit.is_bug_fix == True,  # noqa: E712
                )
            )
        ).scalar() or 0

        weekly.append(WeeklyBucket(
            week=week_start.strftime("%Y-%m-%d"),
            commits=week_commits,
            bug_fixes=week_bug_fixes,
        ))

    # ── Issue risk ───────────────────────────────────────────────────────
    open_issues = (
        await db.execute(
            select(func.count(Issue.id)).where(
                Issue.repo_id == repo_id, Issue.status == "open"
            )
        )
    ).scalar() or 0

    critical_issues = (
        await db.execute(
            select(func.count(Issue.id)).where(
                Issue.repo_id == repo_id,
                Issue.status == "open",
                Issue.severity == "critical",
            )
        )
    ).scalar() or 0

    # Risk score: blend of critical issues (0-50) + bug_fix_rate (0-25) + churn (0-25)
    risk_from_critical = min(critical_issues * 7, 50)
    risk_from_bugfix = int(bug_fix_rate * 25)

    # ── Hotspots ─────────────────────────────────────────────────────────
    hotspot_rows = (
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
            .limit(10)
        )
    ).all()

    # Issue counts per file
    issue_rows = (
        await db.execute(
            select(Issue.file_path, func.count(Issue.id).label("cnt"))
            .where(Issue.repo_id == repo_id, Issue.status == "open")
            .group_by(Issue.file_path)
        )
    ).all()
    issues_by_file: dict[str, int] = {r.file_path: r.cnt for r in issue_rows}

    hotspots: list[Hotspot] = [
        Hotspot(
            file_path=r.file_path,
            churn=int(r.churn or 0),
            commit_count=int(r.commit_count or 0),
            open_issues=issues_by_file.get(r.file_path, 0),
        )
        for r in hotspot_rows
    ]

    max_churn = hotspots[0].churn if hotspots else 1
    risk_from_churn = int(min(max_churn / max(max_churn, 1), 1.0) * 25)
    risk_score = min(risk_from_critical + risk_from_bugfix + risk_from_churn, 100)

    # ── Coverage ─────────────────────────────────────────────────────────
    from backend.app.models.file import RepoFile  # avoid circular at top level

    symbols_indexed = (
        await db.execute(
            select(func.count(Symbol.id)).where(Symbol.repo_id == repo_id)
        )
    ).scalar() or 0

    embeddings_indexed = (
        await db.execute(
            select(func.count(CodeEmbedding.id)).where(CodeEmbedding.repo_id == repo_id)
        )
    ).scalar() or 0

    files_indexed = (
        await db.execute(
            select(func.count(RepoFile.id)).where(RepoFile.repo_id == repo_id)
        )
    ).scalar() or 0

    return HealthResponse(
        total_commits=total_commits,
        bug_fix_commits=bug_fix_commits,
        bug_fix_rate=bug_fix_rate,
        weekly_velocity=weekly,
        open_issues=open_issues,
        critical_issues=critical_issues,
        risk_score=risk_score,
        hotspots=hotspots,
        symbols_indexed=symbols_indexed,
        embeddings_indexed=embeddings_indexed,
        files_indexed=files_indexed,
    )
