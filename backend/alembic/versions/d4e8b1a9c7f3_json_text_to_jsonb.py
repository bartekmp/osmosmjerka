"""Convert JSON-in-Text columns to native JSONB.

Migrates the columns that stored JSON as `Text` to `JSONB` so they are queryable,
indexable and validated at the database level:
  - scoring_rules.difficulty_multipliers
  - scoring_rules.target_times_seconds
  - teacher_phrase_sets.config  (also gains a JSONB server_default)
  - notifications.metadata

The existing text values are already valid JSON, so `USING <col>::jsonb` casts
them in place. NULLs (notifications.metadata) are preserved.

Revision ID: d4e8b1a9c7f3
Revises: c3a7e9d1f2b8
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d4e8b1a9c7f3"
down_revision: Union[str, Sequence[str], None] = "c3a7e9d1f2b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: spaces after each colon are required — SQLAlchemy's text() parser treats
# ":true"/":false"/":null" as bind parameters, but ": true" is left as a literal.
CONFIG_DEFAULT = (
    '{"allow_hints": true, "show_translations": true, "require_translation_input": false, '
    '"show_timer": false, "strict_grid_size": false, "grid_size": 10, '
    '"time_limit_minutes": null, "difficulty": "medium"}'
)


def upgrade() -> None:
    op.execute(
        "ALTER TABLE scoring_rules ALTER COLUMN difficulty_multipliers TYPE jsonb USING difficulty_multipliers::jsonb"
    )
    op.execute(
        "ALTER TABLE scoring_rules ALTER COLUMN target_times_seconds TYPE jsonb USING target_times_seconds::jsonb"
    )
    op.execute("ALTER TABLE teacher_phrase_sets ALTER COLUMN config TYPE jsonb USING config::jsonb")
    op.execute(f"ALTER TABLE teacher_phrase_sets ALTER COLUMN config SET DEFAULT '{CONFIG_DEFAULT}'::jsonb")
    op.execute("ALTER TABLE notifications ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb")


def downgrade() -> None:
    op.execute("ALTER TABLE notifications ALTER COLUMN metadata TYPE text USING metadata::text")
    op.execute("ALTER TABLE teacher_phrase_sets ALTER COLUMN config DROP DEFAULT")
    op.execute("ALTER TABLE teacher_phrase_sets ALTER COLUMN config TYPE text USING config::text")
    op.execute("ALTER TABLE scoring_rules ALTER COLUMN target_times_seconds TYPE text USING target_times_seconds::text")
    op.execute(
        "ALTER TABLE scoring_rules ALTER COLUMN difficulty_multipliers TYPE text USING difficulty_multipliers::text"
    )
