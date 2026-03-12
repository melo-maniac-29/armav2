from sqlalchemy import String, Text, Integer, ForeignKey, Index
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid


class FeatureRequest(Base, TimestampMixin):
    """Tracks a natural-language feature request through plan → code → PR."""

    __tablename__ = "feature_requests"
    __table_args__ = (
        Index("ix_feature_requests_repo_id", "repo_id"),
        Index("ix_feature_requests_user_id", "user_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # JSON string: list of {file_path, action, description}
    plan_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON string: {file_path: new_content}
    patches_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # pending | planning | coding | sandboxing | pushing | pr_opened | failed
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    sandbox_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    # passed | failed | skipped
    sandbox_result: Mapped[str | None] = mapped_column(String(20), nullable=True)

    github_pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    github_pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
