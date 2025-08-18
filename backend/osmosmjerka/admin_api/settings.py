from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse

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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/statistics-enabled")
async def set_statistics_enabled(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable statistics tracking globally - root admin only"""
    enabled = body.get("enabled")
    if enabled is None or not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="'enabled' field must be a boolean")

    try:
        await db_manager.set_global_setting(
            "statistics_enabled",
            "true" if enabled else "false",
            "Global flag to enable/disable statistics tracking",
            user["id"],
        )

        return JSONResponse(
            {"message": f"Statistics tracking {'enabled' if enabled else 'disabled'} successfully", "enabled": enabled}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear-all-statistics")
async def clear_all_statistics(user=Depends(require_root_admin)) -> JSONResponse:
    """Clear all statistics data - root admin only"""
    try:
        await db_manager.clear_all_statistics()
        return JSONResponse({"message": "All statistics data cleared successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scoring-enabled")
async def get_scoring_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current scoring system status - root admin only"""
    try:
        enabled = await db_manager.is_scoring_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scoring-enabled")
async def set_scoring_enabled(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable scoring system globally - root admin only"""
    enabled = body.get("enabled")
    if enabled is None or not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="'enabled' field must be a boolean")

    try:
        await db_manager.set_global_setting(
            "scoring_enabled",
            "true" if enabled else "false",
            "Global flag to enable/disable scoring system",
            user["id"],
        )

        return JSONResponse(
            {"message": f"Scoring system {'enabled' if enabled else 'disabled'} successfully", "enabled": enabled}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progressive-hints-enabled")
async def get_progressive_hints_enabled(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current progressive hints status - root admin only"""
    try:
        enabled = await db_manager.is_progressive_hints_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progressive-hints-enabled")
async def set_progressive_hints_enabled(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Enable or disable progressive hints globally - root admin only"""
    enabled = body.get("enabled")
    if enabled is None or not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="'enabled' field must be a boolean")

    try:
        await db_manager.set_global_setting(
            "progressive_hints_enabled",
            "true" if enabled else "false",
            "Global flag to enable/disable progressive hints system",
            user["id"],
        )

        return JSONResponse(
            {"message": f"Progressive hints {'enabled' if enabled else 'disabled'} successfully", "enabled": enabled}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Alternative endpoints that match frontend expectations
@router.get("/statistics")
async def get_statistics_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current statistics tracking status - alternative endpoint"""
    return await get_statistics_enabled(user)


@router.put("/statistics")
async def update_statistics_setting(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Update statistics tracking status - alternative endpoint"""
    return await set_statistics_enabled(body, user)


@router.get("/scoring")
async def get_scoring_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current scoring system status - alternative endpoint"""
    return await get_scoring_enabled(user)


@router.put("/scoring")
async def update_scoring_setting(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Update scoring system status - alternative endpoint"""
    return await set_scoring_enabled(body, user)


@router.get("/progressive-hints")
async def get_progressive_hints_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current progressive hints status - alternative endpoint"""
    return await get_progressive_hints_enabled(user)


@router.put("/progressive-hints")
async def update_progressive_hints_setting(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Update progressive hints status - alternative endpoint"""
    return await set_progressive_hints_enabled(body, user)
