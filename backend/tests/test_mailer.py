"""Tests for outbound transactional email."""

import smtplib
from unittest.mock import patch

import pytest
from osmosmjerka import mailer


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ("SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_SECURITY", "MAIL_FROM"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("APP_BASE_URL", "https://osmosmjerka.example/")


class TestConsoleFallback:
    """With no SMTP server configured the flow must still complete, offline."""

    @pytest.mark.asyncio
    async def test_reports_success_and_logs_the_message(self, caplog):
        assert not mailer.is_configured()

        with caplog.at_level("INFO"):
            assert await mailer.send_email("someone@example.com", "Subject here", "Body here") is True

        assert "Body here" in caplog.text

    @pytest.mark.asyncio
    async def test_verification_email_contains_the_link(self, caplog):
        with caplog.at_level("INFO"):
            await mailer.send_verification_email("someone@example.com", "tok123", "Someone")

        assert "https://osmosmjerka.example/verify-email?token=tok123" in caplog.text


class TestLinkBuilding:
    def test_strips_a_trailing_slash_from_the_base_url(self):
        assert mailer.base_url() == "https://osmosmjerka.example"

    def test_reset_and_verification_links_differ(self):
        assert mailer.verification_link("t") != mailer.reset_link("t")


class TestSmtpDelivery:
    @pytest.mark.asyncio
    async def test_sends_via_starttls_by_default(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        monkeypatch.setenv("SMTP_USERNAME", "mailer@example.com")
        monkeypatch.setenv("SMTP_PASSWORD", "secret")

        with patch("smtplib.SMTP") as smtp_class:
            smtp = smtp_class.return_value.__enter__.return_value
            assert await mailer.send_email("someone@example.com", "Hi", "Body") is True

        assert smtp_class.call_args.args[0] == "smtp.example.com"
        assert smtp_class.call_args.args[1] == 587
        smtp.starttls.assert_called_once()
        smtp.login.assert_called_once_with("mailer@example.com", "secret")
        smtp.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_ssl_mode_uses_the_implicit_tls_port(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        monkeypatch.setenv("SMTP_SECURITY", "ssl")

        with patch("smtplib.SMTP_SSL") as smtp_class:
            await mailer.send_email("someone@example.com", "Hi", "Body")

        assert smtp_class.call_args.args[1] == 465
        smtp_class.return_value.__enter__.return_value.starttls.assert_not_called()

    @pytest.mark.asyncio
    async def test_unauthenticated_relay_skips_login(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_SECURITY", "none")

        with patch("smtplib.SMTP") as smtp_class:
            await mailer.send_email("someone@example.com", "Hi", "Body")

        smtp = smtp_class.return_value.__enter__.return_value
        smtp.login.assert_not_called()
        smtp.starttls.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_delivery_failure_is_reported_not_raised(self, monkeypatch):
        """Registration must not 500 because the relay is down."""
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

        with patch("smtplib.SMTP", side_effect=smtplib.SMTPException("relay refused")):
            assert await mailer.send_email("someone@example.com", "Hi", "Body") is False

    @pytest.mark.asyncio
    async def test_a_network_error_is_reported_not_raised(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")

        with patch("smtplib.SMTP", side_effect=TimeoutError("no route")):
            assert await mailer.send_email("someone@example.com", "Hi", "Body") is False


class TestOutboundBudget:
    """A ceiling on total outbound mail, so bulk abuse can't burn the sending domain."""

    @pytest.fixture(autouse=True)
    def reset_budget(self):
        mailer._recent_sends.clear()
        yield
        mailer._recent_sends.clear()

    @pytest.mark.asyncio
    async def test_sending_stops_once_the_hourly_budget_is_gone(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        monkeypatch.setattr(mailer, "MAX_OUTBOUND_EMAILS_PER_HOUR", 3)

        with patch("smtplib.SMTP") as smtp_class:
            results = [await mailer.send_email("a@b.com", "Hi", "body") for _ in range(5)]

        assert results == [True, True, True, False, False]
        # The refused ones never reach the relay.
        assert smtp_class.call_count == 3

    @pytest.mark.asyncio
    async def test_a_zero_budget_means_unlimited(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        monkeypatch.setattr(mailer, "MAX_OUTBOUND_EMAILS_PER_HOUR", 0)

        with patch("smtplib.SMTP"):
            assert all([await mailer.send_email("a@b.com", "Hi", "body") for _ in range(5)])

    @pytest.mark.asyncio
    async def test_the_budget_does_not_apply_when_mail_is_only_logged(self, monkeypatch):
        """No SMTP server means nothing leaves the process, so there is nothing to ration -
        and development and the E2E suite must not hit a ceiling."""
        monkeypatch.setattr(mailer, "MAX_OUTBOUND_EMAILS_PER_HOUR", 2)

        assert all([await mailer.send_email("a@b.com", "Hi", "body") for _ in range(5)])

    def test_remaining_reports_what_is_left(self, monkeypatch):
        monkeypatch.setattr(mailer, "MAX_OUTBOUND_EMAILS_PER_HOUR", 10)
        assert mailer.outbound_budget_remaining() == 10

        mailer._budget_allows()
        mailer._budget_allows()

        assert mailer.outbound_budget_remaining() == 8
