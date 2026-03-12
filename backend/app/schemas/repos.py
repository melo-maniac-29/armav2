from pydantic import BaseModel
from datetime import datetime


class ConnectRepoRequest(BaseModel):
    github_id: int
    full_name: str
    clone_url: str
    default_branch: str = "main"


class RepoOut(BaseModel):
    id: str
    github_id: int
    full_name: str
    default_branch: str
    status: str
    error_msg: str | None
    webhook_secret: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RepoFileOut(BaseModel):
    id: str
    path: str
    language: str | None
    size_bytes: int | None

    model_config = {"from_attributes": True}
