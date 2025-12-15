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


@router.get("/scoring-rules")
async def get_scoring_rules_setting(user=Depends(require_root_admin)) -> JSONResponse:
    """Get current scoring rules configuration - root admin only"""
    try:
        from osmosmjerka.scoring_rules import DIFFICULTY_ORDER

        rules = await db_manager.get_scoring_rules()
        if not rules:
            # If no rules in DB, initialize with defaults
            await db_manager.initialize_default_scoring_rules()
            rules = await db_manager.get_scoring_rules()

        # At this point, rules should exist
        if rules:
            # Format the response to match the expected structure
            response = {
                "base_points_per_phrase": rules["base_points_per_phrase"],
                "difficulty_multipliers": rules["difficulty_multipliers"],
                "difficulty_order": DIFFICULTY_ORDER,
                "time_bonus": {
                    "max_ratio": rules["max_time_bonus_ratio"],
                    "target_times_seconds": rules["target_times_seconds"],
                },
                "completion_bonus_points": rules["completion_bonus_points"],
                "hint_penalty_per_hint": rules["hint_penalty_per_hint"],
            }
            return JSONResponse(response)
        else:
            raise HTTPException(status_code=500, detail="Failed to initialize scoring rules")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/scoring-rules")
async def update_scoring_rules_setting(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Update scoring rules configuration - root admin only"""
    try:
        # Validate required fields
        required_fields = [
            "base_points_per_phrase",
            "difficulty_multipliers",
            "completion_bonus_points",
            "hint_penalty_per_hint",
        ]

        for field in required_fields:
            if field not in body:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        # Extract time bonus settings (can be nested or flat)
        if "time_bonus" in body:
            max_time_bonus_ratio = body["time_bonus"].get("max_ratio")
            target_times_seconds = body["time_bonus"].get("target_times_seconds")
        else:
            max_time_bonus_ratio = body.get("max_time_bonus_ratio")
            target_times_seconds = body.get("target_times_seconds")

        if max_time_bonus_ratio is None or target_times_seconds is None:
            raise HTTPException(
                status_code=400, detail="Missing time bonus settings (max_ratio and target_times_seconds)"
            )

        # Update scoring rules
        await db_manager.update_scoring_rules(
            base_points_per_phrase=int(body["base_points_per_phrase"]),
            difficulty_multipliers=body["difficulty_multipliers"],
            max_time_bonus_ratio=float(max_time_bonus_ratio),
            target_times_seconds=target_times_seconds,
            completion_bonus_points=int(body["completion_bonus_points"]),
            hint_penalty_per_hint=int(body["hint_penalty_per_hint"]),
            updated_by=user["id"],
        )

        return JSONResponse({"message": "Scoring rules updated successfully"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/list-limits")
async def update_list_limits(body: dict = Body(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Update private list limits - root admin only"""
    try:
        user_limit = body.get("user_limit")
        admin_limit = body.get("admin_limit")

        if user_limit is not None:
            if not isinstance(user_limit, int) or user_limit < 1:
                raise HTTPException(status_code=400, detail="user_limit must be a positive integer")
            await db_manager.set_global_setting(
                "user_private_list_limit",
                str(user_limit),
                "Maximum number of private lists a regular user can create",
                user["id"],
            )

        if admin_limit is not None:
            if not isinstance(admin_limit, int) or admin_limit < 1:
                raise HTTPException(status_code=400, detail="admin_limit must be a positive integer")
            await db_manager.set_global_setting(
                "admin_private_list_limit",
                str(admin_limit),
                "Maximum number of private lists an admin can create",
                user["id"],
            )

        return JSONResponse({"message": "List limits updated successfully"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
