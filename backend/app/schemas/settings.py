from pydantic import BaseModel


class SavePatRequest(BaseModel):
    github_token: str


class SaveOpenAIKeyRequest(BaseModel):
    openai_key: str


class SaveAPIBaseRequest(BaseModel):
    api_base: str          # e.g. http://localhost:5005/v1


class SaveEmbeddingModelRequest(BaseModel):
    embedding_model: str   # e.g. text-embedding-ada-002


class SaveAnalysisModelRequest(BaseModel):
    analysis_model: str    # e.g. gpt-4


class SettingsResponse(BaseModel):
    has_github_token: bool
    has_openai_key: bool = False
    openai_api_base: str | None = None
    embedding_model: str | None = None
    analysis_model: str | None = None

    model_config = {"from_attributes": True}
