"""Rename game_scores.streak_bonus -> completion_bonus.

The column was always a per-puzzle completion bonus (awarded for finding every phrase),
never a real streak. With the new cross-session daily streak (user_streaks) the old name
is actively misleading, so rename it to match reality.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from typing import Sequence, Union

from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("game_scores", "streak_bonus", new_column_name="completion_bonus")


def downgrade() -> None:
    op.alter_column("game_scores", "completion_bonus", new_column_name="streak_bonus")
