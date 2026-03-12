from sqlalchemy import String, Text, Integer, ForeignKey, Index
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid


class PrJob(Base, TimestampMixin):
    """Tracks every auto-fix attempt: generate → sandbox → PR."""

    __tablename__ = "pr_jobs"
    __table_args__ = (
        Index("ix_pr_jobs_repo_id", "repo_id"),
        Index("ix_pr_jobs_issue_id", "issue_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    issue_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False
    )

    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    patch_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # pending | generating | sandboxing | pushing | pr_opened | failed
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    sandbox_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    # sandbox result: passed | failed | skipped
    sandbox_result: Mapped[str | None] = mapped_column(String(20), nullable=True)

    github_pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    github_pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
