import os
import sys
import urllib.parse
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make osmosmjerka importable when running alembic CLI from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from osmosmjerka.database.models import metadata  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = metadata


def get_url() -> str:
    pg_host = os.getenv("POSTGRES_HOST")
    pg_port = os.getenv("POSTGRES_PORT")
    pg_user = urllib.parse.quote_plus(os.getenv("POSTGRES_USER", ""))
    pg_password = urllib.parse.quote_plus(os.getenv("POSTGRES_PASSWORD", ""))
    pg_database = os.getenv("POSTGRES_DATABASE")
    if pg_host and pg_port and pg_user and pg_password and pg_database:
        return f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
    url = config.get_main_option("sqlalchemy.url", "")
    if not url:
        raise ValueError("No database URL configured. Set POSTGRES_* env vars or sqlalchemy.url in alembic.ini.")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
