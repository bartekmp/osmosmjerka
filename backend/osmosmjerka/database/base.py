"""Base DatabaseManager class with connection management and utility methods."""

"""Base DatabaseManager class with connection management and utility methods."""

import datetime
import os
import urllib.parse
from typing import Optional

from databases import Database
from dotenv import load_dotenv
from sqlalchemy import Table, create_engine

from osmosmjerka.database.models import create_phrase_table, metadata
from osmosmjerka.logging_config import get_logger

# Load environment variables
load_dotenv()

logger = get_logger(__name__)


class BaseDatabaseManager:
    """Base database manager class with connection management and utility methods."""

    def __init__(self, database_url: Optional[str] = None):
        self._database_url = database_url
        self.database = None
        self.engine = None
        self._phrase_tables_cache = {}  # Cache for dynamically created phrase tables
        self._statistics_cache = {}  # Cache for user statistics with TTL
        self._statistics_cache_ttl = 300  # 5 minutes cache TTL

    def _serialize_datetimes(self, dict_obj) -> dict:
        """Serialize datetime objects in a dictionary to ISO format strings."""
        serialized_dict = {}
        for k, v in dict_obj.items():
            if isinstance(v, datetime.datetime):
                serialized_dict[k] = v.isoformat()
            else:
                serialized_dict[k] = v
        return serialized_dict

    def _ensure_database(self):
        """Ensure database connection is initialized."""
        if self.database is None:
            raise RuntimeError("Database connection is not initialized. Call connect() first.")
        return self.database

    def _ensure_engine(self):
        """Ensure database engine is initialized."""
        if self.engine is None:
            raise RuntimeError("Database engine is not initialized. Call connect() first.")
        return self.engine

    def _ensure_database_url(self):
        """Get database URL from environment or instance variable."""
        if self._database_url:
            return self._database_url
        pg_host = os.getenv("POSTGRES_HOST")
        pg_port = os.getenv("POSTGRES_PORT")
        pg_user = urllib.parse.quote_plus(os.getenv("POSTGRES_USER", ""))
        pg_password = urllib.parse.quote_plus(os.getenv("POSTGRES_PASSWORD", ""))
        pg_database = os.getenv("POSTGRES_DATABASE")
        if not pg_host or not pg_port or not pg_user or not pg_password or not pg_database:
            raise ValueError("PostgreSQL connection parameters are not set in environment variables.")
        return f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"

    async def connect(self):
        """Connect to the database and ensure tables exist."""
        try:
            database_url = self._ensure_database_url()
            # Extract host and port for logging (without credentials)
            pg_host = os.getenv("POSTGRES_HOST")
            pg_port = os.getenv("POSTGRES_PORT")
            pg_database = os.getenv("POSTGRES_DATABASE")

            if self.database is None:
                self.database = Database(database_url)
            if self.engine is None:
                self.engine = create_engine(database_url)

            await self.database.connect()
            logger.info(
                "Connected to PostgreSQL database",
                extra={
                    "db_host": pg_host,
                    "db_port": pg_port,
                    "db_name": pg_database,
                },
            )
            self.create_tables()
        except Exception as exc:
            logger.exception("Failed to connect to database", extra={"error": str(exc)})
            raise

    async def disconnect(self):
        """Disconnect from the database."""
        if self.database:
            await self.database.disconnect()
            logger.info("Disconnected from database")

    def create_tables(self):
        """Create base tables if they don't exist."""
        if self.engine:
            try:
                metadata.create_all(bind=self.engine)
                logger.debug("Database tables verified/created")
            except Exception as exc:
                logger.exception("Failed to create database tables", extra={"error": str(exc)})
                raise

    def _get_phrase_table_name(self, language_set_name: str) -> str:
        """Get the table name for a language set's phrases using the set's short name."""
        # Sanitize the name to ensure it's safe for SQL table names
        safe_name = language_set_name.replace("-", "_").replace(" ", "_").lower()
        return f"phrases_{safe_name}"

    def _get_phrase_table(self, language_set_name: str) -> Table:
        """Get or create a phrase table for a specific language set."""
        table_name = self._get_phrase_table_name(language_set_name)

        # Check cache first
        if table_name in self._phrase_tables_cache:
            return self._phrase_tables_cache[table_name]

        # Create new table object
        phrase_table = create_phrase_table(table_name)
        self._phrase_tables_cache[table_name] = phrase_table

        # Create the actual table in database if it doesn't exist
        if self.engine:
            phrase_table.create(bind=self.engine, checkfirst=True)

        return phrase_table

    async def _ensure_phrase_table_exists(self, language_set_name: str):
        """Ensure phrase table exists for the given language set."""
        table_name = self._get_phrase_table_name(language_set_name)
        database = self._ensure_database()

        # Check if table exists
        result = await database.fetch_one(
            f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table_name}')"
        )

        if not (result and result[0]):
            # Table doesn't exist, create it
            phrase_table = self._get_phrase_table(language_set_name)
            if self.engine:
                phrase_table.create(bind=self.engine, checkfirst=True)
