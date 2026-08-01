"""Tests for the admin-editable email templates."""

from unittest.mock import AsyncMock, patch

import pytest
from osmosmjerka import email_templates
from osmosmjerka.email_templates import (
    PASSWORD_RESET,
    VERIFICATION,
    TemplateError,
    render_markdown,
    render_preview,
    validate_template,
)

VALID_BODY = "Hi {{name}},\n\nConfirm here: [Confirm]({{link}})\n"


@pytest.fixture
def db():
    mock = AsyncMock()
    mock.get_global_setting.side_effect = lambda key, default=None: default
    with patch.object(email_templates, "db_manager", mock):
        yield mock


class TestValidation:
    def test_accepts_a_sane_template(self):
        assert validate_template(VERIFICATION, "Subject {{app_name}}", VALID_BODY) is None

    def test_rejects_an_unknown_placeholder_and_names_it(self):
        with pytest.raises(TemplateError) as exc:
            validate_template(VERIFICATION, "Subject", "Hi {{nmae}} {{link}}")
        assert "{{nmae}}" in str(exc.value)

    def test_rejects_a_body_without_the_link(self):
        """An email nobody can act on is worse than no change at all."""
        with pytest.raises(TemplateError):
            validate_template(VERIFICATION, "Subject", "Hi {{name}}, welcome aboard.")

    @pytest.mark.parametrize("subject,body", [("", VALID_BODY), ("   ", VALID_BODY), ("Subject", "  ")])
    def test_rejects_empty_fields(self, subject, body):
        with pytest.raises(TemplateError):
            validate_template(VERIFICATION, subject, body)

    def test_rejects_an_absurdly_long_body(self):
        with pytest.raises(TemplateError):
            validate_template(VERIFICATION, "Subject", "{{link}}" + "x" * 20001)

    def test_rejects_an_unknown_template_kind(self):
        with pytest.raises(TemplateError):
            validate_template("newsletter", "Subject", VALID_BODY)

    def test_the_built_in_defaults_pass_their_own_validation(self):
        for kind, default in email_templates.DEFAULTS.items():
            assert validate_template(kind, default["subject"], default["body"]) is None


class TestRendering:
    def test_markdown_becomes_html(self):
        html = render_markdown("Hello **world**", "Osmosmjerka")
        assert "<strong>world</strong>" in html
        assert html.startswith("<!doctype html>")

    def test_raw_html_in_a_template_is_escaped_not_executed(self):
        """The admin is trusted, but a template must never be able to inject script."""
        html = render_markdown("<script>alert(1)</script>", "Osmosmjerka")
        assert "<script>alert(1)</script>" not in html
        assert "&lt;script&gt;" in html

    def test_javascript_urls_never_become_links(self):
        """markdown-it refuses the URL, so the text stays inert rather than linking."""
        html = render_markdown("[click](javascript:alert(1))", "Osmosmjerka")
        assert "<a href" not in html

    def test_preview_substitutes_sample_values(self):
        subject, text, html = render_preview(VERIFICATION, "Hi {{app_name}}", VALID_BODY)
        assert "{{" not in subject
        assert "{{" not in text
        assert "Alex" in text
        assert "<a href=" in html

    def test_preview_never_mints_a_real_token(self):
        _, text, _ = render_preview(VERIFICATION, "S", VALID_BODY)
        assert "EXAMPLE-TOKEN" in text

    @pytest.mark.asyncio
    async def test_render_uses_the_stored_template(self, db):
        db.get_global_setting.side_effect = lambda key, default=None: (
            "Stored subject" if key.endswith("subject") else "Stored body {{link}}"
        )

        subject, text, _ = await email_templates.render(VERIFICATION, {"link": "https://x.example"})

        assert subject == "Stored subject"
        assert text == "Stored body https://x.example"

    @pytest.mark.asyncio
    async def test_render_falls_back_when_the_stored_template_is_invalid(self, db):
        """A template that lost its {{link}} must not ship an unusable email."""
        db.get_global_setting.side_effect = lambda key, default=None: (
            "Broken" if key.endswith("subject") else "No link here at all"
        )

        subject, text, _ = await email_templates.render(VERIFICATION, {"app_name": "Osmosmjerka", "link": "L"})

        assert subject != "Broken"
        assert "L" in text

    @pytest.mark.asyncio
    async def test_a_database_failure_falls_back_to_the_default(self, db):
        """Confirming an account must not depend on the settings table being readable."""
        db.get_global_setting.side_effect = RuntimeError("db down")

        template = await email_templates.get_template(VERIFICATION)

        assert template == email_templates.DEFAULTS[VERIFICATION]


class TestPersistence:
    @pytest.mark.asyncio
    async def test_saving_validates_before_storing(self, db):
        with pytest.raises(TemplateError):
            await email_templates.set_template(VERIFICATION, "Subject", "no link", 0)
        db.set_global_setting.assert_not_called()

    @pytest.mark.asyncio
    async def test_saving_stores_subject_and_body(self, db):
        await email_templates.set_template(PASSWORD_RESET, "Subject", VALID_BODY, 7)

        keys = [call.args[0] for call in db.set_global_setting.call_args_list]
        assert keys == ["email_template_password_reset_subject", "email_template_password_reset_body"]
        assert all(call.args[3] == 7 for call in db.set_global_setting.call_args_list)

    @pytest.mark.asyncio
    async def test_reset_restores_the_built_in_default(self, db):
        restored = await email_templates.reset_template(VERIFICATION, 0)

        assert restored == email_templates.DEFAULTS[VERIFICATION]
        assert db.set_global_setting.call_args_list[0].args[1] == email_templates.DEFAULTS[VERIFICATION]["subject"]
