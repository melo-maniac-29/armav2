from sqlalchemy import String, Integer, ForeignKey, Text, Index
from sqlalchemy.orm import mapped_column, Mapped
from backend.app.models.base import Base, TimestampMixin, new_uuid


class Symbol(Base, TimestampMixin):
    """A named code symbol extracted from a file (function, class, method)."""
    __tablename__ = "symbols"
    __table_args__ = (
        Index("ix_symbols_repo_id", "repo_id"),
        Index("ix_symbols_file_id", "file_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    repo_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repo_files.id", ondelete="CASCADE"), nullable=False
    )
    # function | class | method | variable
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    signature: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    docstring: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Comma-separated list of symbol names this symbol calls
    calls: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Comma-separated list of modules this symbol imports
    imports: Mapped[str | None] = mapped_column(Text, nullable=True)
