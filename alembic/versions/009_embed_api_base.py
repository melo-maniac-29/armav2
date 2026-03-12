"""009 — add embed_api_base to user_settings

Revision ID: 009
Revises: 008
"""
import sqlalchemy as sa
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_settings",
        sa.Column("embed_api_base", sa.String(500), nullable=True),
    )


def downgrade():
    op.drop_column("user_settings", "embed_api_base")
