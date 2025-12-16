"""Game session tracking endpoints for game API."""

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse

from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/game/start")
async def start_game_session(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Start a new game session for statistics tracking"""
    try:
        language_set_id = body.get("language_set_id")
        category = body.get("category")
        difficulty = body.get("difficulty")
        grid_size = body.get("grid_size")
        total_phrases = body.get("total_phrases")

        if not all([language_set_id, category, difficulty, grid_size, total_phrases]):
            logger.warning(
                "Game start failed: missing required fields",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "Missing required fields: language_set_id, category, difficulty, grid_size, total_phrases"},
                status_code=400,
            )

        # Type validation
        if not isinstance(language_set_id, int) or not isinstance(grid_size, int) or not isinstance(total_phrases, int):
            logger.warning(
                "Game start failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "language_set_id, grid_size, and total_phrases must be integers"}, status_code=400
            )

        if not isinstance(category, str) or not isinstance(difficulty, str):
            logger.warning(
                "Game start failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse({"error": "category and difficulty must be strings"}, status_code=400)

        session_id = await db_manager.start_game_session(
            user["id"], language_set_id, category, difficulty, grid_size, total_phrases
        )

        logger.info(
            "Game session started",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": session_id,
                "language_set_id": language_set_id,
                "category": category,
                "difficulty": difficulty,
                "grid_size": grid_size,
                "total_phrases": total_phrases,
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
async def update_game_progress(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Update game progress (phrases found so far)"""
    try:
        session_id = body.get("session_id")
        phrases_found = body.get("phrases_found")

        if session_id is None or phrases_found is None:
            return JSONResponse({"error": "Missing required fields: session_id, phrases_found"}, status_code=400)

        if not isinstance(session_id, int) or not isinstance(phrases_found, int):
            return JSONResponse({"error": "session_id and phrases_found must be integers"}, status_code=400)

        await db_manager.update_game_progress(session_id, phrases_found)
        return JSONResponse({"message": "Game progress updated"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/game/complete")
async def complete_game_session(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Complete a game session and update statistics"""
    try:
        session_id = body.get("session_id")
        phrases_found = body.get("phrases_found")
        duration_seconds = body.get("duration_seconds")

        if session_id is None or phrases_found is None or duration_seconds is None:
            logger.warning(
                "Game complete failed: missing required fields",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "Missing required fields: session_id, phrases_found, duration_seconds"}, status_code=400
            )

        if (
            not isinstance(session_id, int)
            or not isinstance(phrases_found, int)
            or not isinstance(duration_seconds, int)
        ):
            logger.warning(
                "Game complete failed: invalid field types",
                extra={"user_id": user["id"], "username": user["username"]},
            )
            return JSONResponse(
                {"error": "session_id, phrases_found, and duration_seconds must be integers"}, status_code=400
            )

        await db_manager.complete_game_session(session_id, phrases_found, duration_seconds)

        logger.info(
            "Game session completed",
            extra={
                "user_id": user["id"],
                "username": user["username"],
                "session_id": session_id,
                "phrases_found": phrases_found,
                "duration_seconds": duration_seconds,
            },
        )

        return JSONResponse({"message": "Game session completed and statistics updated"})
    except Exception as e:
        logger.exception(
            "Failed to complete game session",
            extra={"user_id": user["id"], "username": user["username"], "error": str(e)},
        )
        return JSONResponse({"error": str(e)}, status_code=500)
