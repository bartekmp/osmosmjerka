"""Add accounts.sessions_valid_from, so a password change can end existing sessions.

Access tokens are stateless and live for an hour, so before this a password reset left
whoever else held a token signed in for up to that long - the opposite of what someone
resetting a compromised account expects. Tokens issued before this instant are now
refused.

Nullable, and NULL means "no cut-off": existing sessions stay valid across the deploy
rather than logging the whole user base out.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: str | Sequence[str] | None = "e1f2a3b4c5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("sessions_valid_from", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "sessions_valid_from")
