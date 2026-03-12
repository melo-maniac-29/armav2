from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from backend.app.models.base import Base
from backend.app.models.user import User  # noqa: F401  — registers table

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    import os
    from sqlalchemy import create_engine

    db_url = os.environ.get("ARMA_DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    # alembic uses sync engine
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    connectable = create_engine(sync_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
