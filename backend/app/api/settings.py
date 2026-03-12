from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from backend.app.db import get_db
from backend.app.models.user import User
from backend.app.models.settings import UserSettings
from backend.app.models.base import new_uuid
from backend.app.schemas.settings import SavePatRequest, SettingsResponse
from backend.app.services.encryption import encrypt, decrypt
from backend.app.api.deps import get_current_user

router = APIRouter()


async def _get_or_create_settings(user_id: str, db: AsyncSession) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(id=new_uuid(), user_id=user_id)
        db.add(settings)
        await db.flush()
    return settings


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    s = result.scalar_one_or_none()
    return SettingsResponse(has_github_token=bool(s and s.github_token_encrypted))


@router.put("/github-token", response_model=SettingsResponse)
async def save_github_token(
    body: SavePatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = body.github_token.strip()
    if not token.startswith("ghp_") and not token.startswith("github_pat_"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Token must be a GitHub Personal Access Token (starts with ghp_ or github_pat_)",
        )

    # Verify the token actually works against GitHub API
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="GitHub token is invalid or expired")
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not verify token with GitHub API")

    s = await _get_or_create_settings(current_user.id, db)
    s.github_token_encrypted = encrypt(token)
    await db.commit()
    return SettingsResponse(has_github_token=True)


@router.delete("/github-token", response_model=SettingsResponse)
async def delete_github_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    s = result.scalar_one_or_none()
    if s:
        s.github_token_encrypted = None
        await db.commit()
    return SettingsResponse(has_github_token=False)
