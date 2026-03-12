from sqlalchemy import String, Integer, ForeignKey, Text, Index
from sqlalchemy.orm import mapped_column, Mapped
from pgvector.sqlalchemy import Vector
from backend.app.models.base import Base, new_uuid
from backend.app.config import get_settings

EMBEDDING_DIM: int = get_settings().embedding_dim


class CodeEmbedding(Base):
    """Semantic embedding for a code chunk (file or function body)."""
    __tablename__ = "code_embeddings"
    __table_args__ = (
        Index("ix_code_embeddings_repo_id", "repo_id"),
        Index("ix_code_embeddings_file_id", "file_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repo_files.id", ondelete="CASCADE"), nullable=False
    )
    # file | function | class
    chunk_type: Mapped[str] = mapped_column(String(20), nullable=False, default="file")
    chunk_name: Mapped[str] = mapped_column(String(255), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    embedding: Mapped[list] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
