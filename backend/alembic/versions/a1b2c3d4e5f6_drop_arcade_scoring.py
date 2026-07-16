"""Drop the arcade scoring system (game_scores, scoring_rules).

The points-based arcade score (base + difficulty/time/completion bonuses − hint
penalty) is replaced by the already-shipped mastery/streak progression system
(user_word_mastery, user_streaks). This drops both scoring tables outright.

IMPORTANT: this is destructive and not reversible — all historical game_scores rows
are permanently lost. Only run against production as a deliberate, explicitly
confirmed deploy step, not bundled into a routine merge/deploy.

Revision ID: a1b2c3d4e5f6
Revises: d0e1f2a3b4c5
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("game_scores")
    op.drop_table("scoring_rules")


def downgrade() -> None:
    # Irreversible: historical score data is gone. Restore from a database backup if
    # a rollback is required.
    pass
