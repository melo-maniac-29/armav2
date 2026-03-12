"""008 — feature_requests table

Revision ID: 008
Revises: 007
"""
import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "feature_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "repo_id",
            sa.String(36),
            sa.ForeignKey("repos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("branch_name", sa.String(200), nullable=True),
        sa.Column("plan_json", sa.Text, nullable=True),
        sa.Column("patches_json", sa.Text, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("error_msg", sa.Text, nullable=True),
        sa.Column("sandbox_log", sa.Text, nullable=True),
        sa.Column("sandbox_result", sa.String(20), nullable=True),
        sa.Column("github_pr_number", sa.Integer, nullable=True),
        sa.Column("github_pr_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_feature_requests_repo_id", "feature_requests", ["repo_id"])
    op.create_index("ix_feature_requests_user_id", "feature_requests", ["user_id"])


def downgrade():
    op.drop_index("ix_feature_requests_user_id")
    op.drop_index("ix_feature_requests_repo_id")
    op.drop_table("feature_requests")
