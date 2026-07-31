"""Tests for the public self-service account endpoints.

The behaviours worth pinning down here are the security properties: no enumeration, tokens
that are hashed at rest and only redeemable once, and the policy applying everywhere a
password can be set.
"""

import os
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ["TESTING"] = "true"  # disables the per-IP rate limiter

from osmosmjerka import auth_api  # noqa: E402
from osmosmjerka.database.account_tokens import (  # noqa: E402
    PURPOSE_EMAIL_VERIFICATION,
    PURPOSE_PASSWORD_RESET,
    hash_account_token,
)

GOOD_PASSWORD = "a-decent-passphrase"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(auth_api.router)
    return TestClient(app)


@pytest.fixture
def db():
    """Patch the database layer with an AsyncMock, defaulting to 'nothing exists'."""
    mock = AsyncMock()
    mock.get_account_by_email.return_value = None
    mock.get_account_by_username.return_value = None
    mock.get_account_by_id.return_value = {"id": 5, "username": "someone", "email": "new@example.com"}
    mock.create_account.return_value = 5
    mock.count_recent_account_tokens.return_value = 0
    mock.is_registration_enabled.return_value = True
    with patch.object(auth_api, "db_manager", mock):
        yield mock


@pytest.fixture
def mail():
    """Capture outgoing mail instead of sending (or logging) it."""
    with (
        patch.object(auth_api, "send_verification_email", AsyncMock(return_value=True)) as verification,
        patch.object(auth_api, "send_password_reset_email", AsyncMock(return_value=True)) as reset,
    ):
        yield {"verification": verification, "reset": reset}


class TestRegistration:
    def test_creates_unverified_account_and_sends_link(self, client, db, mail):
        response = client.post(
            "/api/auth/register",
            json={"email": "New@Example.com", "password": GOOD_PASSWORD, "username": "newbie"},
        )

        assert response.status_code == 202
        kwargs = db.create_account.call_args.kwargs
        assert kwargs["email"] == "new@example.com"  # normalized
        assert kwargs["email_verified"] is False
        assert kwargs["password_hash"].startswith("$argon2id$")
        assert kwargs["role"] == "regular"
        mail["verification"].assert_awaited_once()

    def test_stores_only_a_hash_of_the_token(self, client, db, mail):
        client.post("/api/auth/register", json={"email": "new@example.com", "password": GOOD_PASSWORD})

        emailed_token = mail["verification"].call_args.args[1]
        stored_hash = db.create_account_token.call_args.args[2]
        assert stored_hash != emailed_token
        assert stored_hash == hash_account_token(emailed_token)
        assert len(stored_hash) == 64

    def test_derives_a_username_when_none_is_given(self, client, db, mail):
        client.post("/api/auth/register", json={"email": "bartek@example.com", "password": GOOD_PASSWORD})

        assert db.create_account.call_args.kwargs["username"] == "bartek"

    def test_existing_confirmed_address_is_indistinguishable(self, client, db, mail):
        db.get_account_by_email.return_value = {"id": 9, "username": "taken", "email_verified": True}

        response = client.post("/api/auth/register", json={"email": "taken@example.com", "password": GOOD_PASSWORD})

        # Same status and same body as a successful sign-up, and no account is touched.
        assert response.status_code == 202
        assert response.json()["message"] == auth_api._GENERIC_REGISTER_MESSAGE
        db.create_account.assert_not_called()
        # Nothing is emailed either, so this can't be used to spam somebody's inbox.
        mail["verification"].assert_not_awaited()

    def test_existing_unconfirmed_address_gets_a_fresh_link(self, client, db, mail):
        db.get_account_by_email.return_value = {"id": 9, "username": "pending", "email_verified": False}

        response = client.post("/api/auth/register", json={"email": "pending@example.com", "password": GOOD_PASSWORD})

        assert response.status_code == 202
        db.create_account.assert_not_called()
        mail["verification"].assert_awaited_once()

    def test_rejects_a_taken_display_name(self, client, db, mail):
        db.get_account_by_username.return_value = {"id": 3, "username": "newbie"}

        response = client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": GOOD_PASSWORD, "username": "newbie"},
        )

        assert response.status_code == 409
        db.create_account.assert_not_called()

    @pytest.mark.parametrize("email", ["not-an-email", "no@tld", "@example.com", "spaces in@example.com", ""])
    def test_rejects_malformed_addresses(self, client, db, mail, email):
        response = client.post("/api/auth/register", json={"email": email, "password": GOOD_PASSWORD})

        assert response.status_code == 400
        db.create_account.assert_not_called()

    def test_applies_the_password_policy(self, client, db, mail):
        response = client.post("/api/auth/register", json={"email": "new@example.com", "password": "short"})

        assert response.status_code == 400
        db.create_account.assert_not_called()
        mail["verification"].assert_not_awaited()

    def test_can_be_disabled_by_the_root_admin(self, client, db, mail):
        db.is_registration_enabled.return_value = False

        response = client.post("/api/auth/register", json={"email": "new@example.com", "password": GOOD_PASSWORD})

        assert response.status_code == 403
        db.create_account.assert_not_called()
        mail["verification"].assert_not_awaited()

    def test_config_reports_the_closed_state_so_the_form_can_hide(self, client, db):
        db.is_registration_enabled.return_value = False

        assert client.get("/api/auth/config").json()["registration_enabled"] is False


class TestEmailConfirmation:
    def test_confirms_the_account(self, client, db):
        db.consume_account_token.return_value = {"id": 1, "account_id": 5}

        response = client.post("/api/auth/verify-email", json={"token": "some-token"})

        assert response.status_code == 200
        db.consume_account_token.assert_awaited_once_with(hash_account_token("some-token"), PURPOSE_EMAIL_VERIFICATION)
        db.update_account.assert_awaited_once_with(5, email_verified=True)

    def test_rejects_a_spent_or_unknown_token(self, client, db):
        db.consume_account_token.return_value = None

        response = client.post("/api/auth/verify-email", json={"token": "stale"})

        assert response.status_code == 400
        db.update_account.assert_not_called()

    def test_resend_is_throttled_per_account(self, client, db, mail):
        db.get_account_by_email.return_value = {"id": 5, "username": "pending", "email_verified": False}
        db.count_recent_account_tokens.return_value = 5

        response = client.post("/api/auth/resend-verification", json={"email": "pending@example.com"})

        assert response.status_code == 202
        mail["verification"].assert_not_awaited()

    def test_resend_for_an_unknown_address_looks_identical(self, client, db, mail):
        response = client.post("/api/auth/resend-verification", json={"email": "nobody@example.com"})

        assert response.status_code == 202
        assert response.json()["message"] == auth_api._GENERIC_REGISTER_MESSAGE
        mail["verification"].assert_not_awaited()


class TestPasswordReset:
    def test_sends_a_link_for_a_known_address(self, client, db, mail):
        db.get_account_by_email.return_value = {"id": 5, "username": "someone", "is_active": True}

        response = client.post("/api/auth/forgot-password", json={"email": "someone@example.com"})

        assert response.status_code == 202
        mail["reset"].assert_awaited_once()
        assert db.create_account_token.call_args.args[1] == PURPOSE_PASSWORD_RESET
        # Reset links must be short-lived.
        assert db.create_account_token.call_args.args[3] <= timedelta(hours=1)

    def test_unknown_address_looks_identical(self, client, db, mail):
        response = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})

        assert response.status_code == 202
        assert response.json()["message"] == auth_api._GENERIC_RESET_MESSAGE
        mail["reset"].assert_not_awaited()

    def test_deactivated_account_gets_no_link(self, client, db, mail):
        db.get_account_by_email.return_value = {"id": 5, "username": "banned", "is_active": False}

        response = client.post("/api/auth/forgot-password", json={"email": "banned@example.com"})

        assert response.status_code == 202
        mail["reset"].assert_not_awaited()

    def test_sets_the_new_password_and_clears_the_lockout(self, client, db):
        db.get_account_token_owner.return_value = {"id": 1, "account_id": 5}
        db.consume_account_token.return_value = {"id": 1, "account_id": 5}

        response = client.post("/api/auth/reset-password", json={"token": "tok", "password": GOOD_PASSWORD})

        assert response.status_code == 200
        kwargs = db.update_account.call_args.kwargs
        assert kwargs["password_hash"].startswith("$argon2id$")
        # Holding the emailed link proves mailbox control.
        assert kwargs["email_verified"] is True
        db.clear_failed_logins.assert_awaited_once_with(5)
        db.invalidate_account_tokens.assert_awaited_once_with(5, PURPOSE_PASSWORD_RESET)

    def test_rejects_an_invalid_token(self, client, db):
        db.get_account_token_owner.return_value = None

        response = client.post("/api/auth/reset-password", json={"token": "stale", "password": GOOD_PASSWORD})

        assert response.status_code == 400
        db.update_account.assert_not_called()

    def test_a_weak_password_does_not_burn_the_token(self, client, db):
        db.get_account_token_owner.return_value = {"id": 1, "account_id": 5}

        response = client.post("/api/auth/reset-password", json={"token": "tok", "password": "short"})

        assert response.status_code == 400
        db.consume_account_token.assert_not_called()
        db.update_account.assert_not_called()

    def test_race_on_the_same_link_is_caught_at_redemption(self, client, db):
        """The peek can succeed and the redeeming UPDATE still lose - that must not 500."""
        db.get_account_token_owner.return_value = {"id": 1, "account_id": 5}
        db.consume_account_token.return_value = None

        response = client.post("/api/auth/reset-password", json={"token": "tok", "password": GOOD_PASSWORD})

        assert response.status_code == 400
        db.update_account.assert_not_called()


def test_config_exposes_what_the_signup_form_needs(client, db):
    response = client.get("/api/auth/config")

    assert response.status_code == 200
    body = response.json()
    assert "registration_enabled" in body
    assert body["min_password_length"] >= 8
