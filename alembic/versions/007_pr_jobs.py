"""007 — pr_jobs table for Phase 3 auto-fix pipeline."""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pr_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("repo_id", sa.String(36), sa.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_id", sa.String(36), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_name", sa.String(200), nullable=True),
        sa.Column("patch_text", sa.Text, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("error_msg", sa.Text, nullable=True),
        sa.Column("sandbox_log", sa.Text, nullable=True),
        sa.Column("sandbox_result", sa.String(20), nullable=True),
        sa.Column("github_pr_number", sa.Integer, nullable=True),
        sa.Column("github_pr_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pr_jobs_repo_id", "pr_jobs", ["repo_id"])
    op.create_index("ix_pr_jobs_issue_id", "pr_jobs", ["issue_id"])


def downgrade() -> None:
    op.drop_table("pr_jobs")
