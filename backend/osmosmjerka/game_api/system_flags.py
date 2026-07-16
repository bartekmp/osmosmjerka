"""Public system feature-flag endpoints (progressive hints, TTS)."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/system/progressive-hints-enabled")
async def get_system_progressive_hints_enabled() -> JSONResponse:
    """Get system-wide progressive hints enabled status (public endpoint)"""
    try:
        enabled = await db_manager.is_progressive_hints_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        logger.exception("Failed to check progressive hints status")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/system/tts-enabled")
async def get_system_tts_enabled() -> JSONResponse:
    """Get system-wide text-to-speech enabled status (public endpoint)"""
    try:
        enabled = await db_manager.is_tts_enabled_globally()
        return JSONResponse({"enabled": enabled})
    except Exception as e:
        logger.exception("Failed to check TTS status")
        return JSONResponse({"error": str(e)}, status_code=500)
