"""Database migration script to add game_type column to relevant tables.

This script runs at application startup, adds the game_type column to
game_sessions, scoring_rules, and game_scores tables if missing,
then removes itself after successful execution.
"""

import logging
import os
from pathlib import Path

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)

MIGRATION_NAME = "add_game_type"
MIGRATION_MARKER_FILE = Path(__file__).parent / f".{MIGRATION_NAME}_completed"


def check_column_exists(engine, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def run_migration(engine) -> bool:
    """
    Add game_type column to game_sessions, scoring_rules, and game_scores tables.

    Returns True if migration was successful or already applied, False on error.
    """
    # Check if migration was already completed
    if MIGRATION_MARKER_FILE.exists():
        logger.info(f"Migration '{MIGRATION_NAME}' already completed, skipping.")
        return True

    tables_to_migrate = ["game_sessions", "scoring_rules", "game_scores"]

    try:
        with engine.connect() as conn:
            for table_name in tables_to_migrate:
                # Check if table exists
                inspector = inspect(engine)
                if table_name not in inspector.get_table_names():
                    logger.info(f"Table '{table_name}' does not exist, skipping.")
                    continue

                # Check if column already exists
                if check_column_exists(engine, table_name, "game_type"):
                    logger.info(f"Column 'game_type' already exists in '{table_name}'.")
                    continue

                # Add the column with default value
                logger.info(f"Adding 'game_type' column to '{table_name}'...")
                conn.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN game_type VARCHAR(20) " f"NOT NULL DEFAULT 'word_search'"
                    )
                )
                conn.commit()
                logger.info(f"Successfully added 'game_type' to '{table_name}'.")

        # Mark migration as completed
        MIGRATION_MARKER_FILE.touch()
        logger.info(f"Migration '{MIGRATION_NAME}' completed successfully.")

        # Self-remove the migration script
        _self_remove()

        return True

    except Exception as e:
        logger.error(f"Migration '{MIGRATION_NAME}' failed: {e}")
        return False


def _self_remove():
    """Remove this migration script and its marker file after successful execution."""
    try:
        script_path = Path(__file__)

        # Remove the script file
        if script_path.exists():
            os.remove(script_path)
            logger.info(f"Migration script '{script_path.name}' removed.")

        # Remove the marker file
        if MIGRATION_MARKER_FILE.exists():
            os.remove(MIGRATION_MARKER_FILE)
            logger.info("Migration marker file removed.")

    except Exception as e:
        logger.warning(f"Could not remove migration files: {e}")
