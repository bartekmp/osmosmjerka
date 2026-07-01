"""Drop the legacy per-language-set phrase tables.

Cleanup migration that follows b2f1c0d4e5a6 (which consolidated all phrases into a single
`phrases` table but intentionally LEFT the old `phrases_<name>` tables in place as a
backup). This drops every remaining legacy `phrases_<name>` table.

IMPORTANT: only deploy this after the consolidation migration has been applied AND
verified in production, since it is destructive and not reversible.

Revision ID: c3a7e9d1f2b8
Revises: b2f1c0d4e5a6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3a7e9d1f2b8"
down_revision: Union[str, Sequence[str], None] = "b2f1c0d4e5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    # Match the legacy naming (`phrases_<name>`); the consolidated table is `phrases`
    # (no underscore) and is therefore not matched by the '^phrases_' pattern.
    legacy = bind.execute(
        sa.text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name ~ '^phrases_'"
        )
    ).fetchall()
    for (table_name,) in legacy:
        op.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')


def downgrade() -> None:
    # Irreversible: the legacy tables' data was already consolidated into `phrases`.
    # Restore from a database backup if a rollback is required.
    pass
