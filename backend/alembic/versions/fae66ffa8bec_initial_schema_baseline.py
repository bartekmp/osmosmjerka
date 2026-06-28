"""initial schema baseline

Revision ID: fae66ffa8bec
Revises:
Create Date: 2026-06-28 21:11:19.997498

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "fae66ffa8bec"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
