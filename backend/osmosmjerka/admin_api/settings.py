from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from osmosmjerka.admin_api.schemas import EnabledToggle, ListLimitsUpdate
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
