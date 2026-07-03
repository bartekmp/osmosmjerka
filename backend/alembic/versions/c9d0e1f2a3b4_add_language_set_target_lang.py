"""Add language_sets.target_lang (BCP-47 code for text-to-speech).

Phase 4 (TTS) groundwork: records the target language's BCP-47 code per language set so
the client can set SpeechSynthesisUtterance.lang and pick a matching voice. Nullable —
sets without it simply won't offer the listen button (graceful degrade).

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("language_sets", sa.Column("target_lang", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("language_sets", "target_lang")
