"""Consolidate per-language-set phrase tables into a single phrases table.

Creates a single `phrases` table keyed by language_set_id, copies rows from every
legacy dynamic `phrases_<name>` table, and remaps the phrase_id references stored in
`user_private_list_phrases` and `teacher_phrase_set_phrases` (which pointed at the
per-set tables' local ids) to the new global ids.

The old `phrases_<name>` tables are intentionally left in place as a backup; a follow-up
migration can drop them once this is verified in production.

Revision ID: b2f1c0d4e5a6
Revises: fae66ffa8bec
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2f1c0d4e5a6"
down_revision: Union[str, Sequence[str], None] = "fae66ffa8bec"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _legacy_table_name(language_set_name: str) -> str:
    """Replicate the old dynamic table naming exactly."""
    safe = language_set_name.replace("-", "_").replace(" ", "_").lower()
    return f"phrases_{safe}"


def upgrade() -> None:
    op.create_table(
        "phrases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "language_set_id",
            sa.Integer(),
            sa.ForeignKey("language_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("categories", sa.String(), nullable=False),
        sa.Column("phrase", sa.String(), nullable=False),
        sa.Column("translation", sa.Text(), nullable=False),
    )
    op.create_index("ix_phrases_language_set_id", "phrases", ["language_set_id"])
    op.create_index("idx_phrases_set_id", "phrases", ["language_set_id", "id"])

    bind = op.get_bind()

    language_sets = bind.execute(sa.text("SELECT id, name FROM language_sets")).fetchall()

    # (language_set_id, old_phrase_id) -> new global phrase id
    id_map: dict[tuple[int, int], int] = {}

    for set_id, set_name in language_sets:
        legacy = _legacy_table_name(set_name)
        exists = bind.execute(sa.text("SELECT to_regclass(:t)"), {"t": f"public.{legacy}"}).scalar()
        if not exists:
            continue

        rows = bind.execute(
            sa.text(f'SELECT id, categories, phrase, translation FROM "{legacy}" ORDER BY id')
        ).fetchall()

        for old_id, categories, phrase, translation in rows:
            new_id = bind.execute(
                sa.text(
                    "INSERT INTO phrases (language_set_id, categories, phrase, translation) "
                    "VALUES (:ls, :c, :p, :t) RETURNING id"
                ),
                {"ls": set_id, "c": categories, "p": phrase, "t": translation},
            ).scalar()
            id_map[(set_id, old_id)] = new_id

    # Remap phrase_id references in the junction tables.
    for table in ("user_private_list_phrases", "teacher_phrase_set_phrases"):
        refs = bind.execute(
            sa.text(f"SELECT id, language_set_id, phrase_id FROM {table} WHERE phrase_id IS NOT NULL")
        ).fetchall()
        for row_id, ls_id, old_phrase_id in refs:
            new_id = id_map.get((ls_id, old_phrase_id))
            if new_id is not None:
                bind.execute(
                    sa.text(f"UPDATE {table} SET phrase_id = :new WHERE id = :rid"),
                    {"new": new_id, "rid": row_id},
                )


def downgrade() -> None:
    # The legacy phrases_<name> tables were left intact by upgrade(), so the data still
    # lives there; simply drop the consolidated table. (Junction phrase_id values are not
    # reverted — restore from backup if a full rollback is required.)
    op.drop_index("idx_phrases_set_id", table_name="phrases")
    op.drop_index("ix_phrases_language_set_id", table_name="phrases")
    op.drop_table("phrases")
