"""Add server-side defaults for columns that only had client-side (ORM) defaults.

Columns defined with SQLAlchemy ``default=`` get their value filled in by the ORM/Core on
insert, but raw SQL inserts — bulk phrase import, the prod->staging clone job, ad-hoc
`INSERT`s and future migrations — bypass that and hit NOT NULL violations (or, for nullable
columns, unexpected NULLs). This sweep gives every such column a matching ``server_default``
so the database fills the value regardless of how the row is inserted.

Values-only change: all affected columns are NOT NULL and already populated, so there are no
existing NULLs to backfill.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, server-default SQL) — mirrors the client-side default= in models.py.
DEFAULTS: list[tuple[str, str, str]] = [
    ("language_sets", "is_active", "true"),
    ("language_sets", "is_default", "false"),
    ("accounts", "role", "'regular'"),
    ("accounts", "account_tier", "'tier1'"),
    ("accounts", "is_active", "true"),
    ("user_statistics", "games_started", "0"),
    ("user_statistics", "games_completed", "0"),
    ("user_statistics", "puzzles_solved", "0"),
    ("user_statistics", "total_phrases_found", "0"),
    ("user_statistics", "total_time_played_seconds", "0"),
    ("user_statistics", "phrases_added", "0"),
    ("user_statistics", "phrases_edited", "0"),
    ("user_category_plays", "plays_count", "1"),
    ("user_category_plays", "phrases_found", "0"),
    ("user_category_plays", "total_time_seconds", "0"),
    ("game_sessions", "phrases_found", "0"),
    ("game_sessions", "is_completed", "false"),
    ("game_sessions", "game_type", "'word_search'"),
    ("scoring_rules", "base_points_per_phrase", "100"),
    ("scoring_rules", "max_time_bonus_ratio", "'0.3'"),
    ("scoring_rules", "completion_bonus_points", "200"),
    ("scoring_rules", "hint_penalty_per_hint", "0"),
    ("scoring_rules", "updated_by", "0"),
    ("scoring_rules", "game_type", "'word_search'"),
    ("game_scores", "hints_used", "0"),
    ("game_scores", "base_score", "0"),
    ("game_scores", "time_bonus", "0"),
    ("game_scores", "difficulty_bonus", "0"),
    ("game_scores", "completion_bonus", "0"),
    ("game_scores", "hint_penalty", "0"),
    ("game_scores", "final_score", "0"),
    ("game_scores", "game_type", "'word_search'"),
    ("user_private_lists", "is_system_list", "false"),
    ("user_list_shares", "permission", "'read'"),
    ("teacher_phrase_sets", "hotlink_version", "1"),
    ("teacher_phrase_sets", "access_type", "'public'"),
    ("teacher_phrase_sets", "is_active", "true"),
    ("teacher_phrase_set_phrases", "position", "0"),
    ("teacher_phrase_set_sessions", "phrases_found", "0"),
    ("teacher_phrase_set_sessions", "is_completed", "false"),
    ("notifications", "is_read", "false"),
    ("teacher_group_members", "status", "'pending'"),
]


def upgrade() -> None:
    for table, column, default in DEFAULTS:
        op.alter_column(table, column, server_default=sa.text(default))


def downgrade() -> None:
    for table, column, _default in DEFAULTS:
        op.alter_column(table, column, server_default=None)
