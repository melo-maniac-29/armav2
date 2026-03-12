import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models.settings import UserSettings
from backend.app.services.encryption import decrypt


async def get_user_token(user_id: str, db: AsyncSession) -> str | None:
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    s = result.scalar_one_or_none()
    if not s or not s.github_token_encrypted:
        return None
    return decrypt(s.github_token_encrypted)


async def list_user_repos(token: str) -> list[dict]:
    """Fetch all repos the token has access to (owner + collaborator), up to 300."""
    repos: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=15) as client:
        while True:
            resp = await client.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                params={
                    "per_page": 100,
                    "page": page,
                    "sort": "updated",
                    "affiliation": "owner,collaborator",
                },
            )
            resp.raise_for_status()
            batch: list[dict] = resp.json()
            if not batch:
                break
            repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1
    return repos
