from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ARMA_", env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://arma:armapassword@localhost:5432/arma"

    # Auth
    secret_key: str = "change-me-in-production-use-32-chars-minimum"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Encryption (Fernet key — base64url, 32 bytes).
    # Leave empty to auto-derive from secret_key (recommended for development).
    # For production set ARMA_ENCRYPTION_KEY to a fixed value so existing
    # encrypted tokens remain decryptable across deployments.
    encryption_key: str = ""

    # App
    env: str = "development"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.env == "development":
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
