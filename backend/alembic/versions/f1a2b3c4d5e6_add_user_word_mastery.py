"""Add user_word_mastery table (per-word spaced-repetition mastery).

Phase 0 of the learning-modes / SRS work: the per-word mastery model. One row per
(user, item, direction), where an item is polymorphic — a public phrase (phrase_id) or a
custom private-list phrase (list_phrase_id), exactly one set. SM-2-lite scheduling fields
(ease/interval/reps/lapses/due_at) mirror Anki. No UI yet; this just creates the store.

Revision ID: f1a2b3c4d5e6
Revises: e5f9c2a1b6d4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e5f9c2a1b6d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_word_mastery",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "phrase_id",
            sa.Integer(),
            sa.ForeignKey("phrases.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "list_phrase_id",
            sa.Integer(),
            sa.ForeignKey("user_private_list_phrases.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "language_set_id",
            sa.Integer(),
            sa.ForeignKey("language_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("direction", sa.String(length=16), nullable=False, server_default="production"),
        sa.Column("ease", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("interval_days", sa.Float(), nullable=False, server_default="0"),
        sa.Column("due_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lapses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mastery_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "((phrase_id IS NOT NULL)::int + (list_phrase_id IS NOT NULL)::int) = 1",
            name="ck_word_mastery_one_ref",
        ),
    )
    op.create_index("ix_user_word_mastery_id", "user_word_mastery", ["id"])
    op.create_index("ix_user_word_mastery_user_id", "user_word_mastery", ["user_id"])
    op.create_index("ix_user_word_mastery_language_set_id", "user_word_mastery", ["language_set_id"])
    op.create_index(
        "uq_word_mastery_public",
        "user_word_mastery",
        ["user_id", "phrase_id", "direction"],
        unique=True,
        postgresql_where=sa.text("phrase_id IS NOT NULL"),
    )
    op.create_index(
        "uq_word_mastery_custom",
        "user_word_mastery",
        ["user_id", "list_phrase_id", "direction"],
        unique=True,
        postgresql_where=sa.text("list_phrase_id IS NOT NULL"),
    )
    op.create_index("idx_word_mastery_due", "user_word_mastery", ["user_id", "language_set_id", "due_at"])
    op.create_index("idx_word_mastery_user_due", "user_word_mastery", ["user_id", "due_at"])


def downgrade() -> None:
    op.drop_table("user_word_mastery")
