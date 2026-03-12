from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid
import datetime


class Commit(Base, TimestampMixin):
    """A git commit associated with a repo."""
    __tablename__ = "commits"
    __table_args__ = (
        Index("ix_commits_repo_id", "repo_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    hash: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    committed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_bug_fix: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    additions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deletions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    files_changed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CommitFile(Base):
    """A file touched in a specific commit."""
    __tablename__ = "commit_files"
    __table_args__ = (
        Index("ix_commit_files_commit_id", "commit_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    commit_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("commits.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    # added | modified | deleted
    change_type: Mapped[str] = mapped_column(String(20), nullable=False, default="modified")
    additions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deletions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
