"""004 — issues table + openai key column in user_settings."""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add openai_token_encrypted column to user_settings
    op.add_column(
        "user_settings",
        sa.Column("openai_token_encrypted", sa.Text(), nullable=True),
    )

    # Create issues table
    op.create_table(
        "issues",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "repo_id",
            sa.String(36),
            sa.ForeignKey("repos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("issue_type", sa.String(30), nullable=False, server_default="other"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
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
    op.create_index("ix_issues_repo_id", "issues", ["repo_id"])
    op.create_index("ix_issues_run_id", "issues", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_issues_run_id", "issues")
    op.drop_index("ix_issues_repo_id", "issues")
    op.drop_table("issues")
    op.drop_column("user_settings", "openai_token_encrypted")
