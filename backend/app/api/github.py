from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db import get_db
from backend.app.models.user import User
from backend.app.schemas.github import GithubRepoItem
from backend.app.services.github import get_user_token, list_user_repos

router = APIRouter()


@router.get("/repos", response_model=list[GithubRepoItem])
async def github_list_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = await get_user_token(current_user.id, db)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub token configured. Add one in Settings first.",
        )
    try:
        raw = await list_user_repos(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return [
        GithubRepoItem(
            id=r["id"],
            full_name=r["full_name"],
            description=r.get("description"),
            private=r["private"],
            default_branch=r.get("default_branch", "main"),
            clone_url=r["clone_url"],
            stargazers_count=r.get("stargazers_count", 0),
            language=r.get("language"),
            updated_at=r.get("updated_at"),
        )
        for r in raw
    ]
