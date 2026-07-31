"""Regression tests for the issues found reviewing the registration work.

Each of these reproduces a specific defect, so a later refactor that reintroduces one
fails here rather than in production.
"""

import asyncio
import statistics
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from osmosmjerka import auth as auth_module
from osmosmjerka import email_templates, mailer
from osmosmjerka.email_templates import VERIFICATION, TemplateError, render_markdown, validate_template
from osmosmjerka.passwords import hash_password

PASSWORD = "a-decent-passphrase"


class TestEmailSubjectCannotBreakSending:
    """A newline in a saved subject used to 500 every registration until an admin noticed."""

    @pytest.mark.parametrize("subject", ["Confirm\nX-Evil: 1", "Confirm\rX-Evil: 1", "Confirm your account\n"])
    def test_a_multiline_subject_is_rejected_when_saved(self, subject):
        with pytest.raises(TemplateError, match="single line"):
            validate_template(VERIFICATION, subject, "Confirm: {{link}}")

    @pytest.mark.asyncio
    async def test_a_malformed_header_reports_failure_instead_of_raising(self, monkeypatch):
        """Even if one gets stored somehow, sending must degrade rather than 500 the flow."""
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

        # Bypasses validation the way a hand-edited settings row would.
        sent = await mailer.send_email("player@example.com", "Confirm\nX-Evil: 1", "body")

        assert sent is False

    @pytest.mark.asyncio
    async def test_registration_survives_a_broken_template(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        broken = {"subject": "Confirm\nX-Evil: 1", "body": "Click {{link}}"}

        with patch.object(email_templates, "get_template", AsyncMock(return_value=broken)):
            # Must not raise: the endpoint's contract is the same whether mail goes out.
            assert await mailer.send_verification_email("player@example.com", "tok", "Alex") is False

    @pytest.mark.asyncio
    async def test_a_malformed_recipient_is_refused_before_smtp(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

        with patch("smtplib.SMTP") as smtp:
            assert await mailer.send_email("a@b.com\nBcc: victim@x.com", "Hi", "body") is False

        smtp.assert_not_called()


class TestPlaceholdersAreDataNotMarkup:
    def test_a_display_name_cannot_introduce_a_link(self):
        html = render_markdown(
            "Hi " + email_templates._escape_markdown("[Click here to win](https://evil.example)") + ",",
            "Osmosmjerka",
        )

        assert "<a href" not in html
        assert "evil.example" in html  # still shown, just inert

    @pytest.mark.asyncio
    async def test_the_link_placeholder_stays_a_working_url(self):
        with patch.object(email_templates.db_manager, "get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)):
            _, text, html = await email_templates.render(
                VERIFICATION,
                {
                    "name": "Alex",
                    "link": "https://app.example/verify-email?token=abc",
                    "app_name": "Osmosmjerka",
                    "expiry_hours": 24,
                },
            )

        assert '<a href="https://app.example/verify-email?token=abc"' in html
        # The plain-text part keeps the value unescaped, so it reads naturally.
        assert "https://app.example/verify-email?token=abc" in text

    @pytest.mark.asyncio
    async def test_a_hostile_name_is_neutralised_in_the_rendered_email(self):
        with patch.object(email_templates.db_manager, "get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)):
            _, _, html = await email_templates.render(
                VERIFICATION,
                {
                    "name": "[Win a prize](https://evil.example)",
                    "link": "https://app.example/verify",
                    "app_name": "Osmosmjerka",
                    "expiry_hours": 24,
                },
            )

        assert 'href="https://evil.example"' not in html


class TestLoginTiming:
    """A missing account used to answer ~2000x faster than a real one."""

    @pytest.mark.asyncio
    async def test_an_unknown_account_costs_the_same_as_a_wrong_password(self):
        known = {
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

        async def median_ms(account):
            db = AsyncMock()
            db.get_account_by_identifier.return_value = account
            db.record_failed_login.return_value = 1
            with patch.object(auth_module, "db_manager", db):
                samples = []
                for _ in range(7):
                    started = time.perf_counter()
                    await auth_module.authenticate_user("someone@example.com", "wrong")
                    samples.append(time.perf_counter() - started)
                return statistics.median(samples)

        existing = await median_ms(known)
        missing = await median_ms(None)

        # Same order of magnitude is the property that matters; exact parity is not
        # achievable and not required to close the oracle.
        assert missing > existing / 3, f"unknown account answered far faster ({missing:.4f}s vs {existing:.4f}s)"


class TestSessionCutoff:
    def test_a_token_issued_before_the_cutoff_is_stale(self):
        cutoff = datetime.now(UTC).replace(tzinfo=None)
        issued_before = (datetime.now(UTC) - timedelta(minutes=5)).timestamp()

        assert auth_module._token_predates_cutoff(issued_before, cutoff) is True

    def test_a_token_issued_after_the_cutoff_is_fine(self):
        cutoff = (datetime.now(UTC) - timedelta(minutes=5)).replace(tzinfo=None)
        issued_after = datetime.now(UTC).timestamp()

        assert auth_module._token_predates_cutoff(issued_after, cutoff) is False

    def test_no_cutoff_leaves_every_session_valid(self):
        """Accounts predating this feature must not all be logged out by the deploy."""
        assert auth_module._token_predates_cutoff(datetime.now(UTC).timestamp(), None) is False

    def test_a_token_without_an_issued_at_is_refused_once_a_cutoff_exists(self):
        cutoff = datetime.now(UTC).replace(tzinfo=None)

        assert auth_module._token_predates_cutoff(None, cutoff) is True

    @pytest.mark.parametrize("cutoff", ["not-a-date", "", 12345])
    def test_a_garbled_cutoff_does_not_lock_anyone_out(self, cutoff):
        assert auth_module._token_predates_cutoff(datetime.now(UTC).timestamp(), cutoff) is False

    @pytest.mark.asyncio
    async def test_resolving_an_account_refuses_a_stale_token(self):
        db = AsyncMock()
        db.get_account_by_username.return_value = {
            "id": 7,
            "username": "someone",
            "role": "regular",
            "is_active": True,
            "sessions_valid_from": datetime.now(UTC).replace(tzinfo=None),
        }
        payload = {
            "sub": "someone",
            "role": "regular",
            "user_id": 7,
            "iat": (datetime.now(UTC) - timedelta(minutes=5)).timestamp(),
        }

        with patch.object(auth_module, "db_manager", db):
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc:
                await auth_module._resolve_account(payload)

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_resolving_an_account_accepts_a_fresh_token(self):
        db = AsyncMock()
        db.get_account_by_username.return_value = {
            "id": 7,
            "username": "someone",
            "role": "regular",
            "is_active": True,
            "sessions_valid_from": (datetime.now(UTC) - timedelta(minutes=5)).replace(tzinfo=None),
        }
        payload = {"sub": "someone", "role": "regular", "user_id": 7, "iat": datetime.now(UTC).timestamp()}

        with patch.object(auth_module, "db_manager", db):
            user = await auth_module._resolve_account(payload)

        assert user["id"] == 7

    @pytest.mark.asyncio
    async def test_a_token_minted_right_after_the_cutoff_is_accepted(self):
        """Resetting and immediately signing in must work.

        A JWT's iat is whole seconds, so a cut-off stored with microseconds would make the
        brand-new token look older than it and sign the user straight back out.
        """
        cutoff = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
        # The login happens a fraction of a second later; jose truncates iat to the second.
        issued_at = float(int((cutoff + timedelta(microseconds=400000)).replace(tzinfo=UTC).timestamp()))

        assert auth_module._token_predates_cutoff(issued_at, cutoff) is False

    def test_issued_tokens_carry_an_issued_at(self):
        with patch.object(auth_module, "SECRET_KEY", "test-secret"):
            token = auth_module.create_access_token({"sub": "someone", "role": "regular", "user_id": 7})
            payload = auth_module._decode_token(token)

        assert "iat" in payload


class TestConfirmationEmailThrottle:
    """Re-submitting the sign-up form used to bypass the cap that resend enforces."""

    @pytest.fixture
    def db(self):
        mock = AsyncMock()
        mock.count_recent_account_tokens.return_value = 0
        from osmosmjerka import auth_api

        with patch.object(auth_api, "db_manager", mock):
            yield mock

    @pytest.mark.asyncio
    async def test_issuing_stops_once_the_account_has_had_its_share(self, db):
        from osmosmjerka import auth_api

        db.count_recent_account_tokens.return_value = auth_api.MAX_EMAILS_PER_ACCOUNT

        with patch.object(auth_api, "send_verification_email", AsyncMock()) as send:
            issued = await auth_api._issue_verification(5, "someone@example.com", "Someone")

        assert issued is False
        send.assert_not_awaited()
        db.create_account_token.assert_not_called()

    @pytest.mark.asyncio
    async def test_issuing_proceeds_below_the_cap(self, db):
        from osmosmjerka import auth_api

        with patch.object(auth_api, "send_verification_email", AsyncMock(return_value=True)) as send:
            issued = await auth_api._issue_verification(5, "someone@example.com", "Someone")

        assert issued is True
        send.assert_awaited_once()


def test_the_dummy_hash_is_a_real_argon2_hash():
    """It has to cost what a real verification costs, or it closes nothing."""
    assert auth_module._DUMMY_PASSWORD_HASH.startswith("$argon2id$")


def test_email_validation_rejects_what_would_break_a_header():
    assert mailer.is_valid_email("someone@example.com") is True
    for bad in ["a@b.com\nBcc: x@y.com", "no-at-sign", "spaces in@example.com", "", "a@b", "x" * 400 + "@e.com"]:
        assert mailer.is_valid_email(bad) is False, bad


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(asyncio.sleep(0))
