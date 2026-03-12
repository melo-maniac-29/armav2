from sqlalchemy import String, Text, Integer, ForeignKey, Index
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid


class Issue(Base, TimestampMixin):
    __tablename__ = "issues"
    __table_args__ = (
        Index("ix_issues_repo_id", "repo_id"),
        Index("ix_issues_run_id", "run_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # critical | error | warning | info
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    # bug | security | performance | style | other
    issue_type: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # open | dismissed | fixed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
