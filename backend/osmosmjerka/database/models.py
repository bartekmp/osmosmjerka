"""SQLAlchemy table definitions for the database schema."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

# Shared metadata for all tables
metadata = MetaData()

# Define the language_sets table
language_sets_table = Table(
    "language_sets",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("name", String, nullable=False, unique=True),  # Short name like "hr-pl"
    Column("display_name", String, nullable=False),  # User-friendly name like "Croatian-Polish"
    Column("description", Text, nullable=True),
    Column("author", String, nullable=True),
    Column("created_by", Integer, nullable=True),  # User ID of creator, NULL for root admin (id=0)
    Column("default_ignored_categories", Text, nullable=True),  # Comma-separated list of ignored categories
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("is_active", Boolean, nullable=False, default=True),
    Column("is_default", Boolean, nullable=False, default=False),
)


# Dynamic phrase table creation function
def create_phrase_table(table_name: str) -> Table:
    """Create a phrases table for a specific language set"""
    return Table(
        table_name,
        metadata,
        Column("id", Integer, primary_key=True, index=True),
        Column("categories", String, nullable=False),
        Column("phrase", String, nullable=False),
        Column("translation", Text, nullable=False),
        extend_existing=True,
    )


# Define the accounts table for user management
accounts_table = Table(
    "accounts",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("username", String, nullable=False, unique=True),
    Column("password_hash", String, nullable=False),
    Column("role", String, nullable=False, default="regular"),  # root_admin, administrative, regular
    Column("self_description", Text),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("is_active", Boolean, nullable=False, default=True),
    Column("last_login", DateTime),
)

# Define the user_ignored_categories table
user_ignored_categories_table = Table(
    "user_ignored_categories",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
)

# Define the user_statistics table for storing game statistics
user_statistics_table = Table(
    "user_statistics",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("games_started", Integer, nullable=False, default=0),
    Column("games_completed", Integer, nullable=False, default=0),
    Column("puzzles_solved", Integer, nullable=False, default=0),
    Column("total_phrases_found", Integer, nullable=False, default=0),
    Column("total_time_played_seconds", Integer, nullable=False, default=0),
    Column("phrases_added", Integer, nullable=False, default=0),
    Column("phrases_edited", Integer, nullable=False, default=0),
    Column("last_played", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

# Define the user_category_plays table for tracking favorite categories
user_category_plays_table = Table(
    "user_category_plays",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False, index=True),
    Column("plays_count", Integer, nullable=False, default=1),
    Column("phrases_found", Integer, nullable=False, default=0),
    Column("total_time_seconds", Integer, nullable=False, default=0),
    Column("last_played", DateTime, nullable=False, server_default=func.now()),
)

# Define the game_sessions table for tracking individual game sessions
game_sessions_table = Table(
    "game_sessions",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
    Column("difficulty", String, nullable=False),
    Column("grid_size", Integer, nullable=False),
    Column("total_phrases", Integer, nullable=False),
    Column("phrases_found", Integer, nullable=False, default=0),
    Column("is_completed", Boolean, nullable=False, default=False),
    Column("start_time", DateTime, nullable=False, server_default=func.now()),
    Column("end_time", DateTime, nullable=True),
    Column("duration_seconds", Integer, nullable=True),
)

# Define the global_settings table for application-wide settings
global_settings_table = Table(
    "global_settings",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("setting_key", String, nullable=False, unique=True),
    Column("setting_value", String, nullable=False),
    Column("description", Text, nullable=True),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_by", Integer, nullable=False),  # User ID of who made the change
)

# Define the scoring_rules table for dynamic scoring configuration
scoring_rules_table = Table(
    "scoring_rules",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("base_points_per_phrase", Integer, nullable=False, default=100),
    Column("difficulty_multipliers", Text, nullable=False),  # JSON string of difficulty multipliers
    Column("max_time_bonus_ratio", String, nullable=False, default="0.3"),  # Stored as string to preserve precision
    Column("target_times_seconds", Text, nullable=False),  # JSON string of target times
    Column("completion_bonus_points", Integer, nullable=False, default=200),
    Column("hint_penalty_per_hint", Integer, nullable=False, default=75),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_by", Integer, nullable=False, default=0),  # User ID of who made the change
)

# Define the user_preferences table for user-specific settings
user_preferences_table = Table(
    "user_preferences",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("preference_key", String, nullable=False),
    Column("preference_value", String, nullable=False),
    Column("updated_at", DateTime, nullable=False, server_default=func.now()),
)

# Define the game_scores table for storing individual game scores
game_scores_table = Table(
    "game_scores",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("session_id", Integer, nullable=False, index=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("language_set_id", Integer, nullable=False, index=True),
    Column("category", String, nullable=False),
    Column("difficulty", String, nullable=False),
    Column("grid_size", Integer, nullable=False),
    Column("total_phrases", Integer, nullable=False),
    Column("phrases_found", Integer, nullable=False),
    Column("hints_used", Integer, nullable=False, default=0),
    Column("base_score", Integer, nullable=False, default=0),
    Column("time_bonus", Integer, nullable=False, default=0),
    Column("difficulty_bonus", Integer, nullable=False, default=0),
    Column("streak_bonus", Integer, nullable=False, default=0),
    Column("hint_penalty", Integer, nullable=False, default=0),
    Column("final_score", Integer, nullable=False, default=0),
    Column("duration_seconds", Integer, nullable=False),
    Column("first_phrase_time", DateTime, nullable=True),
    Column("completion_time", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
)

# Define the user_private_lists table for user-created phrase lists
user_private_lists_table = Table(
    "user_private_lists",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("user_id", Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("language_set_id", Integer, ForeignKey("language_sets.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("list_name", String(255), nullable=False),
    Column("description", Text, nullable=True),
    Column("is_system_list", Boolean, nullable=False, default=False),  # TRUE for "Learn This Later"
    Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Column("updated_at", DateTime, nullable=False, server_default=func.now(), onupdate=func.now()),
    # Unique constraint: user cannot have duplicate list names in same language set
    UniqueConstraint("user_id", "language_set_id", "list_name", name="uq_user_list_name"),
    # Composite index for common query pattern
    Index("idx_user_lang_list", "user_id", "language_set_id"),
)

# Define the user_private_list_phrases table for phrases in private lists
user_private_list_phrases_table = Table(
    "user_private_list_phrases",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("list_id", Integer, ForeignKey("user_private_lists.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("phrase_id", Integer, nullable=True),  # NULL if it's a user-defined phrase
    Column("language_set_id", Integer, nullable=False, index=True),
    # User-defined phrase fields (only populated if phrase_id IS NULL)
    Column("custom_phrase", String(255), nullable=True),
    Column("custom_translation", Text, nullable=True),
    Column("custom_categories", String(255), nullable=True),  # Space-separated like public phrases
    Column("added_at", DateTime, nullable=False, server_default=func.now()),
    # CHECK constraint: either phrase_id OR custom_phrase must be provided
    CheckConstraint(
        "(phrase_id IS NOT NULL) OR (custom_phrase IS NOT NULL)",
        name="check_phrase_or_custom",
    ),
    # Unique constraint: prevent duplicate public phrases in same list
    # Note: This is a partial unique index (PostgreSQL) - only applies when phrase_id IS NOT NULL
    # For SQLite/MySQL, we'll enforce this at application level
    # Composite indexes for performance
    Index("idx_list_phrase", "list_id", "phrase_id"),
    Index("idx_list_added", "list_id", "added_at"),
    Index("idx_list_lang", "list_id", "language_set_id"),
)

# Define the user_list_shares table for sharing lists between users
user_list_shares_table = Table(
    "user_list_shares",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("list_id", Integer, ForeignKey("user_private_lists.id", ondelete="CASCADE"), nullable=False, index=True),
    Column(
        "owner_user_id", Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    ),  # Original list owner
    Column(
        "shared_with_user_id", Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    ),  # User receiving access
    Column("permission", String(20), nullable=False, default="read"),  # 'read' or 'write'
    Column("shared_at", DateTime, nullable=False, server_default=func.now()),
    # Unique constraint: prevent duplicate shares
    UniqueConstraint("list_id", "shared_with_user_id", name="uq_list_shared_with"),
    # CHECK constraint: permission must be 'read' or 'write'
    CheckConstraint("permission IN ('read', 'write')", name="check_permission"),
    # Composite indexes for performance
    Index("idx_shared_with_list", "shared_with_user_id", "list_id"),
    Index("idx_list_shared_with", "list_id", "shared_with_user_id"),
)
