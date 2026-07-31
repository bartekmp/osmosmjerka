from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from osmosmjerka import email_templates, mailer
from osmosmjerka.admin_api.schemas import EmailTemplateUpdate, EmailTestSend, EnabledToggle, ListLimitsUpdate
from osmosmjerka.auth import require_root_admin
from osmosmjerka.database import db_manager

router = APIRouter(prefix="/settings")


@router.get("/statistics-enabled")
async def get_statistics_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current statistics tracking status - root admin only"""
    try:
        enabled = await db_manager.is_statistics_enabled()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/statistics-enabled")
async def set_statistics_enabled(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable statistics tracking globally - root admin only"""
    try:
        await db_manager.set_global_setting(
            "statistics_enabled",
            "true" if body.enabled else "false",
            "Global flag to enable/disable statistics tracking",
            user["id"],
        )

        return JSONResponse(
            {
                "message": f"Statistics tracking {'enabled' if body.enabled else 'disabled'} successfully",
                "enabled": body.enabled,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/clear-all-statistics")
async def clear_all_statistics(user=Depends(require_root_admin)) -> JSONResponse:
    """Clear all statistics data - root admin only"""
    try:
        await db_manager.clear_all_statistics()
        return JSONResponse({"message": "All statistics data cleared successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/progressive-hints-enabled")
async def get_progressive_hints_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current progressive hints status - root admin only"""
    try:
        enabled = await db_manager.is_progressive_hints_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/progressive-hints-enabled")
async def set_progressive_hints_enabled(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable progressive hints globally - root admin only"""
    try:
        await db_manager.set_global_setting(
            "progressive_hints_enabled",
            "true" if body.enabled else "false",
            "Global flag to enable/disable progressive hints system",
            user["id"],
        )

        return JSONResponse(
            {
                "message": f"Progressive hints {'enabled' if body.enabled else 'disabled'} successfully",
                "enabled": body.enabled,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Alternative endpoints that match frontend expectations
@router.get("/statistics")
async def get_statistics_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current statistics tracking status - alternative endpoint"""
    return await get_statistics_enabled(user)


@router.put("/statistics")
async def update_statistics_setting(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Update statistics tracking status - alternative endpoint"""
    return await set_statistics_enabled(body, user)


@router.get("/progressive-hints")
async def get_progressive_hints_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current progressive hints status - alternative endpoint"""
    return await get_progressive_hints_enabled(user)


@router.put("/progressive-hints")
async def update_progressive_hints_setting(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Update progressive hints status - alternative endpoint"""
    return await set_progressive_hints_enabled(body, user)


@router.get("/registration-enabled")
async def get_registration_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current self-service registration status - root admin only"""
    try:
        enabled = await db_manager.is_registration_enabled()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/registration-enabled")
async def set_registration_enabled(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Open or close self-service registration - root admin only.

    When closed, the sign-up form disappears and /api/auth/register refuses outright;
    accounts can then only be created from this dashboard."""
    try:
        await db_manager.set_global_setting(
            "registration_enabled",
            "true" if body.enabled else "false",
            "Global flag to open/close self-service account registration",
            user["id"],
        )
        return JSONResponse(
            {
                "message": f"Self-service registration {'enabled' if body.enabled else 'disabled'} successfully",
                "enabled": body.enabled,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/registration")
async def get_registration_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current registration status - alternative endpoint"""
    return await get_registration_enabled(user)


@router.put("/registration")
async def update_registration_setting(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Update registration status - alternative endpoint"""
    return await set_registration_enabled(body, user)


@router.get("/tts-enabled")
async def get_tts_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current text-to-speech (voice packs) status - root admin only"""
    try:
        enabled = await db_manager.is_tts_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/tts-enabled")
async def set_tts_enabled(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable in-browser text-to-speech globally - root admin only.

    When disabled, clients hide the voice UI and never download voice models."""
    try:
        await db_manager.set_global_setting(
            "tts_enabled",
            "true" if body.enabled else "false",
            "Global flag to enable/disable in-browser text-to-speech (voice packs)",
            user["id"],
        )
        return JSONResponse(
            {
                "message": f"Text-to-speech {'enabled' if body.enabled else 'disabled'} successfully",
                "enabled": body.enabled,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/tts")
async def get_tts_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current text-to-speech status - alternative endpoint"""
    return await get_tts_enabled(user)


@router.put("/tts")
async def update_tts_setting(body: EnabledToggle, user=Depends(require_root_admin)) -> JSONResponse:
    """Update text-to-speech status - alternative endpoint"""
    return await set_tts_enabled(body, user)


# ===== Private List Limits =====


@router.get("/list-limits")
async def get_list_limits(user=Depends(require_root_admin)) -> JSONResponse:
    """Get private list limits for users and admins - root admin only"""
    try:
        user_limit = await db_manager.get_global_setting("user_private_list_limit", "50")
        admin_limit = await db_manager.get_global_setting("admin_private_list_limit", "500")

        return JSONResponse(
            {
                "user_limit": int(user_limit) if user_limit else 50,
                "admin_limit": int(admin_limit) if admin_limit else 500,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/list-limits")
async def update_list_limits(body: ListLimitsUpdate, user=Depends(require_root_admin)) -> JSONResponse:
    """Update private list limits - root admin only"""
    try:
        if body.user_limit is not None:
            await db_manager.set_global_setting(
                "user_private_list_limit",
                str(body.user_limit),
                "Maximum number of private lists a regular user can create",
                user["id"],
            )

        if body.admin_limit is not None:
            await db_manager.set_global_setting(
                "admin_private_list_limit",
                str(body.admin_limit),
                "Maximum number of private lists an admin can create",
                user["id"],
            )

        return JSONResponse({"message": "List limits updated successfully"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ===== Email Templates =====


@router.get("/email-templates")
async def list_email_templates(user=Depends(require_root_admin)) -> JSONResponse:
    """Every editable template, plus the metadata the editor needs - root admin only."""
    templates = {}
    for kind in email_templates.DEFAULTS:
        stored = await email_templates.get_template(kind)
        templates[kind] = {
            **stored,
            "placeholders": sorted(email_templates.PLACEHOLDERS[kind]),
            "is_default": stored == email_templates.DEFAULTS[kind],
        }
    return JSONResponse(
        {
            "templates": templates,
            "smtp_configured": mailer.is_configured(),
            "from_address": mailer.sender_address(),
        }
    )


@router.put("/email-templates/{kind}")
async def update_email_template(kind: str, body: EmailTemplateUpdate, user=Depends(require_root_admin)) -> JSONResponse:
    """Save a template - root admin only."""
    if kind not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown template: {kind}")
    try:
        await email_templates.set_template(kind, body.subject, body.body, user["id"])
    except email_templates.TemplateError as exc:
        # A bad placeholder is the admin's mistake to fix, not a server fault.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse({"message": "Template saved", **await email_templates.get_template(kind)})


@router.post("/email-templates/{kind}/reset")
async def reset_email_template(kind: str, user=Depends(require_root_admin)) -> JSONResponse:
    """Restore the built-in default for a template - root admin only."""
    if kind not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown template: {kind}")
    restored = await email_templates.reset_template(kind, user["id"])
    return JSONResponse({"message": "Template restored to the default", **restored})


@router.post("/email-templates/{kind}/preview")
async def preview_email_template(
    kind: str, body: EmailTemplateUpdate, user=Depends(require_root_admin)
) -> JSONResponse:
    """Render unsaved edits with sample values, so the admin can see them before saving.

    Rendered server-side with the same code that sends the real thing, so the preview
    can't drift from what recipients get.
    """
    if kind not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown template: {kind}")
    try:
        email_templates.validate_template(kind, body.subject, body.body)
    except email_templates.TemplateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    subject, text_body, html_body = email_templates.render_preview(kind, body.subject, body.body)
    return JSONResponse({"subject": subject, "text": text_body, "html": html_body})


@router.post("/email-templates/{kind}/test")
async def send_test_email(kind: str, body: EmailTestSend, user=Depends(require_root_admin)) -> JSONResponse:
    """Send the saved template to an address, to check SMTP and how it renders.

    The link points at the app root rather than a real token: this is a rendering and
    delivery check, and minting a usable confirmation token for an arbitrary address would
    be a way to confirm an account you don't own.
    """
    if kind not in email_templates.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown template: {kind}")

    sent = await email_templates.send_test(kind, body.email)
    if not sent:
        raise HTTPException(status_code=502, detail="Could not send the email - check the SMTP settings")
    detail = (
        f"Test email sent to {body.email}"
        if mailer.is_configured()
        else "SMTP is not configured, so the test email was written to the application log"
    )
    return JSONResponse({"message": detail})
