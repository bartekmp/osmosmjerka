"""Tests for the admin-side account controls: registration toggle, manual confirmation,
and the email-template editor."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from osmosmjerka.admin_api import router
from osmosmjerka.auth import require_admin_access, require_root_admin
from osmosmjerka.database.account_tokens import PURPOSE_EMAIL_VERIFICATION
from osmosmjerka.email_templates import DEFAULTS, VERIFICATION

app = FastAPI()
app.include_router(router)


@pytest.fixture
def client():
    app.dependency_overrides = {}
    return TestClient(app)


@pytest.fixture
def as_root(client, mock_root_admin_user):
    app.dependency_overrides[require_root_admin] = lambda: mock_root_admin_user
    app.dependency_overrides[require_admin_access] = lambda: mock_root_admin_user
    return client


class TestRegistrationToggle:
    def test_reports_the_current_state(self, as_root):
        with patch("osmosmjerka.database.db_manager.is_registration_enabled", AsyncMock(return_value=False)):
            response = as_root.get("/admin/settings/registration")

        assert response.status_code == 200
        assert response.json()["enabled"] is False

    def test_closing_registration_stores_the_flag(self, as_root):
        with (
            patch("osmosmjerka.database.db_manager.set_global_setting", AsyncMock()) as set_setting,
            patch("osmosmjerka.database.db_manager.is_registration_enabled", AsyncMock(return_value=False)),
        ):
            response = as_root.put("/admin/settings/registration", json={"enabled": False})

        assert response.status_code == 200
        assert set_setting.call_args.args[0] == "registration_enabled"
        assert set_setting.call_args.args[1] == "false"

    def test_requires_root_admin(self, client, mock_admin_user):
        """An ordinary administrative user must not be able to reopen sign-ups."""
        response = client.put("/admin/settings/registration", json={"enabled": True})

        assert response.status_code in (401, 403)


class TestManualConfirmation:
    def test_confirms_a_pending_account_and_voids_its_link(self, as_root):
        account = {"id": 4, "username": "pending", "email": "p@example.com", "email_verified": False}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.database.db_manager.update_account", AsyncMock()) as update,
            patch("osmosmjerka.database.db_manager.invalidate_account_tokens", AsyncMock()) as invalidate,
        ):
            response = as_root.post("/admin/users/4/confirm-email")

        assert response.status_code == 200
        update.assert_awaited_once_with(4, email_verified=True)
        # An old emailed link must not stay usable after a manual confirmation.
        invalidate.assert_awaited_once_with(4, PURPOSE_EMAIL_VERIFICATION)

    def test_is_idempotent_for_an_already_confirmed_account(self, as_root):
        account = {"id": 4, "username": "done", "email": "d@example.com", "email_verified": True}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.database.db_manager.update_account", AsyncMock()) as update,
        ):
            response = as_root.post("/admin/users/4/confirm-email")

        assert response.status_code == 200
        update.assert_not_called()

    def test_refuses_an_account_with_no_address(self, as_root):
        account = {"id": 4, "username": "legacy", "email": None, "email_verified": False}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.database.db_manager.update_account", AsyncMock()) as update,
        ):
            response = as_root.post("/admin/users/4/confirm-email")

        assert response.status_code == 400
        update.assert_not_called()

    def test_404s_for_an_unknown_account(self, as_root):
        with patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=None)):
            response = as_root.post("/admin/users/999/confirm-email")

        assert response.status_code == 404

    def test_resend_issues_a_fresh_link(self, as_root):
        account = {"id": 4, "username": "pending", "email": "p@example.com", "email_verified": False}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.database.db_manager.create_account_token", AsyncMock()) as create_token,
            patch("osmosmjerka.admin_api.users.send_verification_email", AsyncMock(return_value=True)) as send,
        ):
            response = as_root.post("/admin/users/4/resend-verification")

        assert response.status_code == 200
        assert create_token.call_args.args[1] == PURPOSE_EMAIL_VERIFICATION
        assert send.call_args.args[0] == "p@example.com"

    def test_resend_refuses_an_already_confirmed_account(self, as_root):
        account = {"id": 4, "username": "done", "email": "d@example.com", "email_verified": True}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.admin_api.users.send_verification_email", AsyncMock()) as send,
        ):
            response = as_root.post("/admin/users/4/resend-verification")

        assert response.status_code == 400
        send.assert_not_called()

    def test_resend_reports_a_delivery_failure(self, as_root):
        account = {"id": 4, "username": "pending", "email": "p@example.com", "email_verified": False}
        with (
            patch("osmosmjerka.database.db_manager.get_account_by_id", AsyncMock(return_value=account)),
            patch("osmosmjerka.database.db_manager.create_account_token", AsyncMock()),
            patch("osmosmjerka.admin_api.users.send_verification_email", AsyncMock(return_value=False)),
        ):
            response = as_root.post("/admin/users/4/resend-verification")

        assert response.status_code == 502


class TestEmailTemplateEditor:
    def test_lists_every_template_with_its_placeholders(self, as_root):
        with patch("osmosmjerka.database.db_manager.get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)):
            response = as_root.get("/admin/settings/email-templates")

        assert response.status_code == 200
        body = response.json()
        assert set(body["templates"]) == set(DEFAULTS)
        assert "link" in body["templates"][VERIFICATION]["placeholders"]
        assert body["templates"][VERIFICATION]["is_default"] is True
        assert "smtp_configured" in body

    def test_saves_a_valid_template(self, as_root):
        with (
            patch("osmosmjerka.database.db_manager.set_global_setting", AsyncMock()) as set_setting,
            patch("osmosmjerka.database.db_manager.get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)),
        ):
            response = as_root.put(
                f"/admin/settings/email-templates/{VERIFICATION}",
                json={"subject": "Hi", "body": "Confirm: {{link}}"},
            )

        assert response.status_code == 200
        assert set_setting.await_count == 2

    def test_rejects_a_template_with_a_typo_in_a_placeholder(self, as_root):
        with patch("osmosmjerka.database.db_manager.set_global_setting", AsyncMock()) as set_setting:
            response = as_root.put(
                f"/admin/settings/email-templates/{VERIFICATION}",
                json={"subject": "Hi", "body": "Confirm: {{lnk}}"},
            )

        assert response.status_code == 400
        assert "{{lnk}}" in response.json()["detail"]
        set_setting.assert_not_called()

    def test_404s_for_an_unknown_template(self, as_root):
        response = as_root.put("/admin/settings/email-templates/newsletter", json={"subject": "Hi", "body": "{{link}}"})

        assert response.status_code == 404

    def test_preview_renders_without_saving(self, as_root):
        with patch("osmosmjerka.database.db_manager.set_global_setting", AsyncMock()) as set_setting:
            response = as_root.post(
                f"/admin/settings/email-templates/{VERIFICATION}/preview",
                json={"subject": "Hi {{app_name}}", "body": "Confirm: [here]({{link}})"},
            )

        assert response.status_code == 200
        body = response.json()
        assert "{{" not in body["subject"]
        assert "<a href=" in body["html"]
        set_setting.assert_not_called()

    def test_reset_restores_the_default(self, as_root):
        with patch("osmosmjerka.database.db_manager.set_global_setting", AsyncMock()) as set_setting:
            response = as_root.post(f"/admin/settings/email-templates/{VERIFICATION}/reset")

        assert response.status_code == 200
        assert response.json()["subject"] == DEFAULTS[VERIFICATION]["subject"]
        assert set_setting.await_count == 2

    def test_test_send_uses_a_sample_link_not_a_real_token(self, as_root):
        """Minting a usable token for an arbitrary address would be an account-takeover path."""
        with (
            patch("osmosmjerka.database.db_manager.get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)),
            patch("osmosmjerka.mailer.send_email", AsyncMock(return_value=True)) as send,
        ):
            response = as_root.post(
                f"/admin/settings/email-templates/{VERIFICATION}/test",
                json={"email": "admin@example.com"},
            )

        assert response.status_code == 200
        sent_body = send.call_args.args[2]
        assert "EXAMPLE-TOKEN" in sent_body

    def test_test_send_reports_an_smtp_failure(self, as_root):
        with (
            patch("osmosmjerka.database.db_manager.get_global_setting", AsyncMock(side_effect=lambda k, d=None: d)),
            patch("osmosmjerka.mailer.send_email", AsyncMock(return_value=False)),
        ):
            response = as_root.post(
                f"/admin/settings/email-templates/{VERIFICATION}/test",
                json={"email": "admin@example.com"},
            )

        assert response.status_code == 502
