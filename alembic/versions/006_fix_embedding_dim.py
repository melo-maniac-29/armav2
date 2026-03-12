"""006 — fix embedding dimension: vector(1536) → vector(768) for nomic-embed-text-v1.5"""
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old 1536-dim column and recreate as 768-dim.
    # We use DROP + ADD because ALTER COLUMN … TYPE vector(N) requires a full table rewrite anyway,
    # and there is no data in the column yet at migration time.
    op.execute("ALTER TABLE code_embeddings DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE code_embeddings ADD COLUMN embedding vector(768)")


def downgrade() -> None:
    op.execute("ALTER TABLE code_embeddings DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE code_embeddings ADD COLUMN embedding vector(1536)")
