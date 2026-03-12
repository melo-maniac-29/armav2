from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.models.base import Base, TimestampMixin, new_uuid


class UserSettings(Base, TimestampMixin):
    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    # GitHub PAT — Fernet-encrypted, null if not set
    github_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    # OpenAI-compatible API key — Fernet-encrypted, null if not set
    openai_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Base URL for OpenAI-compatible server (e.g. http://localhost:5005/v1)
    # Stored in plain text — not sensitive (no credentials here)
    openai_api_base: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Embedding model name served at the above base URL
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Chat model name for analysis (defaults to gpt-4o in analysis service)
    analysis_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
