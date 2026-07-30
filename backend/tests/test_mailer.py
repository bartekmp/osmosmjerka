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
