"""Add email identity, login lockout counters and the account_tokens table.

Self-registration makes the email address the login identifier, so accounts gain
``email`` (unique, lowercased, nullable) and ``email_verified``. Nullable is deliberate:
the root admin, admin-created users and the staging demo account predate registration and
keep logging in by username, so there is nothing to backfill.

``failed_login_attempts`` / ``locked_until`` back the per-account login lockout, and
``account_tokens`` holds hashed single-use tokens for email confirmation and password
reset.

Revision ID: e1f2a3b4c5d6
Revises: a1b2c3d4e5f6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("email", sa.String(length=320), nullable=True))
    op.add_column(
        "accounts",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "accounts",
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("accounts", sa.Column("locked_until", sa.DateTime(), nullable=True))
    # Unique rather than a plain index: two accounts must never share an address. Postgres
    # treats NULLs as distinct, so the pre-registration accounts are unaffected.
    op.create_unique_constraint("uq_accounts_email", "accounts", ["email"])

    op.create_table(
        "account_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_account_tokens_token_hash"),
    )
    op.create_index("ix_account_tokens_id", "account_tokens", ["id"])
    op.create_index("ix_account_tokens_account_id", "account_tokens", ["account_id"])
    op.create_index("idx_account_tokens_lookup", "account_tokens", ["account_id", "purpose"])


def downgrade() -> None:
    op.drop_index("idx_account_tokens_lookup", table_name="account_tokens")
    op.drop_index("ix_account_tokens_account_id", table_name="account_tokens")
    op.drop_index("ix_account_tokens_id", table_name="account_tokens")
    op.drop_table("account_tokens")

    op.drop_constraint("uq_accounts_email", "accounts", type_="unique")
    op.drop_column("accounts", "locked_until")
    op.drop_column("accounts", "failed_login_attempts")
    op.drop_column("accounts", "email_verified")
    op.drop_column("accounts", "email")
