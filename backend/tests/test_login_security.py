"""Tests for the login path's security behaviour.

Covers the three things that changed with email identity: the transparent bcrypt →
Argon2id upgrade, the unconfirmed-email gate, and the per-account brute-force lockout.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import bcrypt
import pytest
from fastapi import HTTPException
from osmosmjerka import auth as auth_module
from osmosmjerka.passwords import hash_password

PASSWORD = "a-decent-passphrase"


def _account(**overrides):
    account = {
        "id": 7,
        "username": "someone",
        "email": "someone@example.com",
        "email_verified": True,
        "password_hash": hash_password(PASSWORD),
        "role": "regular",
        "is_active": True,
        "failed_login_attempts": 0,
        "locked_until": None,
    }
    account.update(overrides)
    return account


@pytest.fixture
def db():
    mock = AsyncMock()
    mock.record_failed_login.return_value = 1
    with patch.object(auth_module, "db_manager", mock):
        yield mock


class TestSuccessfulLogin:
    @pytest.mark.asyncio
    async def test_accepts_the_email_as_identifier(self, db):
        db.get_account_by_identifier.return_value = _account()

        user = await auth_module.authenticate_user("someone@example.com", PASSWORD)

        assert user == {"username": "someone", "role": "regular", "id": 7}
        db.get_account_by_identifier.assert_awaited_once_with("someone@example.com")
        db.update_last_login.assert_awaited_once_with("someone")

    @pytest.mark.asyncio
    async def test_wrong_password_returns_none_and_counts_the_attempt(self, db):
        db.get_account_by_identifier.return_value = _account()

        assert await auth_module.authenticate_user("someone@example.com", "nope") is None
        db.record_failed_login.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_unknown_account_does_not_touch_the_lockout_counter(self, db):
        db.get_account_by_identifier.return_value = None

        assert await auth_module.authenticate_user("nobody@example.com", PASSWORD) is None
        db.record_failed_login.assert_not_called()

    @pytest.mark.asyncio
    async def test_deactivated_account_cannot_log_in(self, db):
        db.get_account_by_identifier.return_value = _account(is_active=False)

        assert await auth_module.authenticate_user("someone@example.com", PASSWORD) is None

    @pytest.mark.asyncio
    async def test_clears_the_counter_after_a_success(self, db):
        db.get_account_by_identifier.return_value = _account(failed_login_attempts=3)

        assert await auth_module.authenticate_user("someone@example.com", PASSWORD) is not None
        db.clear_failed_logins.assert_awaited_once_with(7)


class TestLegacyHashUpgrade:
    @pytest.mark.asyncio
    async def test_bcrypt_account_logs_in_and_is_rehashed(self, db):
        legacy = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
        db.get_account_by_identifier.return_value = _account(password_hash=legacy)

        user = await auth_module.authenticate_user("someone@example.com", PASSWORD)

        assert user is not None
        new_hash = db.update_account.call_args.kwargs["password_hash"]
        assert new_hash.startswith("$argon2id$")

    @pytest.mark.asyncio
    async def test_argon2_account_is_left_alone(self, db):
        db.get_account_by_identifier.return_value = _account()

        await auth_module.authenticate_user("someone@example.com", PASSWORD)

        db.update_account.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_wrong_password_never_rewrites_the_hash(self, db):
        legacy = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
        db.get_account_by_identifier.return_value = _account(password_hash=legacy)

        await auth_module.authenticate_user("someone@example.com", "wrong")

        db.update_account.assert_not_called()


class TestUnverifiedEmailGate:
    @pytest.mark.asyncio
    async def test_unconfirmed_account_is_refused_with_403(self, db):
        db.get_account_by_identifier.return_value = _account(email_verified=False)

        with pytest.raises(HTTPException) as exc:
            await auth_module.authenticate_user("someone@example.com", PASSWORD)

        assert exc.value.status_code == 403
        db.update_last_login.assert_not_called()

    @pytest.mark.asyncio
    async def test_accounts_without_an_email_are_unaffected(self, db):
        """Admin-created and demo accounts predate email identity and must still work."""
        db.get_account_by_identifier.return_value = _account(email=None, email_verified=False)

        assert await auth_module.authenticate_user("someone", PASSWORD) is not None


class TestAccountLockout:
    @pytest.mark.asyncio
    async def test_a_locked_account_is_refused_even_with_the_right_password(self, db):
        locked_until = (datetime.now(UTC) + timedelta(minutes=10)).replace(tzinfo=None)
        db.get_account_by_identifier.return_value = _account(locked_until=locked_until.isoformat())

        with pytest.raises(HTTPException) as exc:
            await auth_module.authenticate_user("someone@example.com", PASSWORD)

        assert exc.value.status_code == 429
        db.update_last_login.assert_not_called()

    @pytest.mark.asyncio
    async def test_an_expired_lock_no_longer_blocks(self, db):
        expired = (datetime.now(UTC) - timedelta(minutes=1)).replace(tzinfo=None)
        db.get_account_by_identifier.return_value = _account(locked_until=expired.isoformat())

        assert await auth_module.authenticate_user("someone@example.com", PASSWORD) is not None

    @pytest.mark.asyncio
    async def test_the_lock_window_is_passed_to_the_database(self, db):
        db.get_account_by_identifier.return_value = _account()

        await auth_module.authenticate_user("someone@example.com", "wrong")

        args = db.record_failed_login.call_args.args
        assert args[0] == 7
        assert args[1] == auth_module.MAX_FAILED_LOGINS
        assert args[2] == auth_module.LOCKOUT_DURATION

    @pytest.mark.parametrize("stored", [None, "", "not-a-date"])
    def test_a_garbled_lock_timestamp_does_not_lock_anyone_out(self, stored):
        assert auth_module._account_lock_expiry({"locked_until": stored}) is None

    def test_an_aware_timestamp_is_compared_correctly(self):
        """The column is naive UTC, but a driver or fixture may hand back an aware value."""
        future = datetime.now(UTC) + timedelta(minutes=5)
        assert auth_module._account_lock_expiry({"locked_until": future}) is not None
        past = datetime.now(UTC) - timedelta(minutes=5)
        assert auth_module._account_lock_expiry({"locked_until": past}) is None
