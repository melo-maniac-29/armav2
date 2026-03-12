from pydantic import BaseModel


class SavePatRequest(BaseModel):
    github_token: str


class SettingsResponse(BaseModel):
    has_github_token: bool

    model_config = {"from_attributes": True}
