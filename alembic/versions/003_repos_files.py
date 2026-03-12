"""phase 1 — repos + repo_files tables

Revision ID: 003
Revises: 002
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "repos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("github_id", sa.Integer, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("clone_url", sa.String(500), nullable=False),
        sa.Column("default_branch", sa.String(100), nullable=False, server_default="main"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_msg", sa.Text, nullable=True),
        sa.Column("webhook_secret", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_repos_user_id", "repos", ["user_id"])
    op.create_unique_constraint("uq_repo_user_github", "repos", ["user_id", "github_id"])

    op.create_table(
        "repo_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "repo_id",
            sa.String(36),
            sa.ForeignKey("repos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("path", sa.String(1000), nullable=False),
        sa.Column("language", sa.String(50), nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_repo_files_repo_id", "repo_files", ["repo_id"])


def downgrade() -> None:
    op.drop_index("ix_repo_files_repo_id", table_name="repo_files")
    op.drop_table("repo_files")
    op.drop_constraint("uq_repo_user_github", "repos", type_="unique")
    op.drop_index("ix_repos_user_id", table_name="repos")
    op.drop_table("repos")
