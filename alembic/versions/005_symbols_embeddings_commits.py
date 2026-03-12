"""005 — symbols, code_embeddings, commits, commit_files tables + LLM settings columns."""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── user_settings: add LLM configuration columns ──────────────────────────
    op.add_column("user_settings", sa.Column("openai_api_base", sa.String(500), nullable=True))
    op.add_column("user_settings", sa.Column("embedding_model", sa.String(100), nullable=True))
    op.add_column("user_settings", sa.Column("analysis_model", sa.String(100), nullable=True))

    # ── symbols ────────────────────────────────────────────────────────────────
    op.create_table(
        "symbols",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("repo_id", sa.String(36), sa.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", sa.String(36), sa.ForeignKey("repo_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("start_line", sa.Integer, nullable=True),
        sa.Column("end_line", sa.Integer, nullable=True),
        sa.Column("signature", sa.String(1000), nullable=True),
        sa.Column("docstring", sa.Text, nullable=True),
        sa.Column("calls", sa.Text, nullable=True),
        sa.Column("imports", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_symbols_repo_id", "symbols", ["repo_id"])
    op.create_index("ix_symbols_file_id", "symbols", ["file_id"])

    # ── code_embeddings ────────────────────────────────────────────────────────
    # The vector dimension here (1536) must match ARMA_EMBEDDING_DIM in config.
    # If you use a model with a different output size, update this before running
    # the migration and regenerate the migration file.
    op.create_table(
        "code_embeddings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("repo_id", sa.String(36), sa.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", sa.String(36), sa.ForeignKey("repo_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_type", sa.String(20), nullable=False, server_default="file"),
        sa.Column("chunk_name", sa.String(255), nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("start_line", sa.Integer, nullable=True),
        sa.Column("end_line", sa.Integer, nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True),
    )
    # Add the pgvector column separately using raw SQL (SQLAlchemy doesn't know this type)
    op.execute("ALTER TABLE code_embeddings ADD COLUMN embedding vector(1536)")
    op.create_index("ix_code_embeddings_repo_id", "code_embeddings", ["repo_id"])
    op.create_index("ix_code_embeddings_file_id", "code_embeddings", ["file_id"])
    # IVFFlat index for fast approximate nearest-neighbour search (created after data load)
    # op.execute("CREATE INDEX ON code_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")

    # ── commits ────────────────────────────────────────────────────────────────
    op.create_table(
        "commits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("repo_id", sa.String(36), sa.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hash", sa.String(40), nullable=False, index=True),
        sa.Column("author_name", sa.String(255), nullable=True),
        sa.Column("author_email", sa.String(255), nullable=True),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("is_bug_fix", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("additions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("deletions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("files_changed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_commits_repo_id", "commits", ["repo_id"])

    # ── commit_files ───────────────────────────────────────────────────────────
    op.create_table(
        "commit_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("commit_id", sa.String(36), sa.ForeignKey("commits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("change_type", sa.String(20), nullable=False, server_default="modified"),
        sa.Column("additions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("deletions", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_commit_files_commit_id", "commit_files", ["commit_id"])


def downgrade() -> None:
    op.drop_table("commit_files")
    op.drop_table("commits")
    op.drop_table("code_embeddings")
    op.drop_table("symbols")
    op.drop_column("user_settings", "analysis_model")
    op.drop_column("user_settings", "embedding_model")
    op.drop_column("user_settings", "openai_api_base")
