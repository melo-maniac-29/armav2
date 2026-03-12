from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid


class RepoFile(Base, TimestampMixin):
    __tablename__ = "repo_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String(1000), nullable=False)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
