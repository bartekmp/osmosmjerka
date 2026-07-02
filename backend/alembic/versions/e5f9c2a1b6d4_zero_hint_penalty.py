"""Stop penalizing hints by default: zero out existing hint_penalty_per_hint.

Hints (revealing a word/direction) are a learning moment, so the default penalty is
now 0. New installs get 0 from the code defaults; this migration updates existing
deployments' stored scoring_rules rows so they stop penalizing immediately. Admins
can re-raise the value via the scoring rules editor.

Revision ID: e5f9c2a1b6d4
Revises: d4e8b1a9c7f3
"""

from typing import Sequence, Union

from alembic import op

revision: str = "e5f9c2a1b6d4"
down_revision: Union[str, Sequence[str], None] = "d4e8b1a9c7f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE scoring_rules SET hint_penalty_per_hint = 0")


def downgrade() -> None:
    # Best-effort restore of the previous default (75). Not a true inverse: any
    # admin-customized value cannot be recovered from here.
    op.execute("UPDATE scoring_rules SET hint_penalty_per_hint = 75")
