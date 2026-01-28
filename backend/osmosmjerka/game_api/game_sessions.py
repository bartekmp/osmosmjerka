"""Game session tracking endpoints for game API."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.game_api.schemas import (
    CompleteGameSessionRequest,
    StartGameSessionRequest,
    UpdateGameProgressRequest,
)
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/game/start")
async def start_game_session(body: StartGameSessionRequest, user=Depends(get_current_user)) -> JSONResponse:
    """Start a new game session for statistics tracking"""
    try:
        session_id = await db_manager.start_game_session(
            user["id"],
            body.language_set_id,
            body.category,
            body.difficulty,
            body.grid_size,
            body.total_phrases,
            body.game_type,
        )

        logger.info(
            "Game session started",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": session_id,
                "language_set_id": body.language_set_id,
                "category": body.category,
                "difficulty": body.difficulty,
                "grid_size": body.grid_size,
                "total_phrases": body.total_phrases,
                "game_type": body.game_type,
            },
        )

        return JSONResponse({"session_id": session_id, "message": "Game session started"})
    except Exception as e:
        logger.exception(
            "Failed to start game session",
            extra={"user_id": user["id"], "username": user["username"], "error": str(e)},
        )
        return JSONResponse({"error": str(e)}, status_code=500)


@router.put("/game/progress")
async def update_game_progress(body: UpdateGameProgressRequest, user=Depends(get_current_user)) -> JSONResponse:
    """Update game progress (phrases found so far)"""
    try:
        await db_manager.update_game_progress(body.session_id, body.phrases_found)
        return JSONResponse({"message": "Game progress updated"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/game/complete")
async def complete_game_session(body: CompleteGameSessionRequest, user=Depends(get_current_user)) -> JSONResponse:
    """Complete a game session and update statistics"""
    try:
        await db_manager.complete_game_session(body.session_id, body.phrases_found, body.duration_seconds)

        logger.info(
            "Game session completed",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": body.session_id,
                "phrases_found": body.phrases_found,
                "duration_seconds": body.duration_seconds,
            },
        )

        return JSONResponse({"message": "Game session completed and statistics updated"})
    except Exception as e:
        logger.exception(
            "Failed to complete game session",
            extra={"user_id": user["id"], "username": user["username"], "error": str(e)},
        )
        return JSONResponse({"error": str(e)}, status_code=500)
