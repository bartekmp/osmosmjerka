"""Teacher phrase sets API endpoints."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user_optional, require_teacher_access
from osmosmjerka.database import db_manager
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.logging_config import get_logger
from pydantic import BaseModel, Field

logger = get_logger(__name__)

router = APIRouter(prefix="/teacher")


# ============================================================================
# Request/Response Models
# ============================================================================


class PhraseSetConfig(BaseModel):
    allow_hints: bool = True
    show_translations: bool = True
    require_translation_input: bool = False
    show_timer: bool = False
    strict_grid_size: bool = False
    grid_size: int = Field(default=10, ge=8, le=20)
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=60)
    difficulty: str = "medium"


class CreatePhraseSetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    language_set_id: int
    phrase_ids: List[int] = Field(..., min_length=1, max_length=50)
    config: Optional[PhraseSetConfig] = None
    access_type: str = Field(default="public", pattern="^(public|private)$")
    max_plays: Optional[int] = Field(default=None, ge=1)
    expires_at: Optional[datetime] = None
    auto_delete_days: Optional[int] = Field(default=14, ge=1, le=90)
    access_user_ids: Optional[List[int]] = None
    access_group_ids: Optional[List[int]] = None
    access_usernames: Optional[List[str]] = None


class UpdatePhraseSetRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    access_type: Optional[str] = Field(None, pattern="^(public|private)$")
    max_plays: Optional[int] = Field(None, ge=1)
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    config: Optional[PhraseSetConfig] = None
    access_user_ids: Optional[List[int]] = None
    access_group_ids: Optional[List[int]] = None
    access_usernames: Optional[List[str]] = None


class ExtendRequest(BaseModel):
    days: int = Field(..., ge=1, le=365)


class StartSessionRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=100)
    grid_size: Optional[int] = Field(None, ge=8, le=20)


class CompleteSessionRequest(BaseModel):
    session_token: str
    phrases_found: int = Field(..., ge=0)
    duration_seconds: int = Field(..., ge=0)
    translation_submissions: Optional[List[dict]] = None


# ============================================================================
# Helper Functions
# ============================================================================


def is_admin_or_higher(user: dict) -> bool:
    """Check if user has admin or higher role."""
    return user.get("role") in ["root_admin", "administrative"]


def error_response(code: str, message: str, status_code: int, details: dict = None) -> JSONResponse:
    """Create standardized error response."""
    response = {
        "error_code": code,
        "message": message,
    }
    if details:
        response["details"] = details
    return JSONResponse(response, status_code=status_code)


# ============================================================================
# Teacher Dashboard Endpoints (Authenticated)
# ============================================================================


@router.get("/phrase-sets")
async def list_phrase_sets(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    active_only: bool = Query(True),
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """List teacher's phrase sets (admins see all)."""
    is_admin = is_admin_or_higher(user)

    result = await db_manager.get_teacher_phrase_sets(
        user_id=user["id"],
        is_admin=is_admin,
        limit=limit,
        offset=offset,
        active_only=active_only,
    )

    return JSONResponse(result)


@router.post("/phrase-sets")
async def create_phrase_set(
    body: CreatePhraseSetRequest,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Create a new phrase set."""
    try:
        # Allow None for indefinite retention
        auto_delete_days = body.auto_delete_days

        # Resolve usernames to IDs
        access_user_ids = body.access_user_ids or []
        if body.access_usernames:
            # Only allow adding users if they are members of the teacher's groups
            valid_user_ids = await db_manager.get_users_in_teacher_groups(
                teacher_id=user["id"],
                usernames=[u.strip() for u in body.access_usernames],
            )
            for uid in valid_user_ids:
                if uid not in access_user_ids:
                    access_user_ids.append(uid)
            # Users not found in groups are silently ignored

        result = await db_manager.create_teacher_phrase_set(
            name=body.name,
            description=body.description,
            language_set_id=body.language_set_id,
            created_by=user["id"],
            phrase_ids=body.phrase_ids,
            config=body.config.model_dump() if body.config else None,
            access_type=body.access_type,
            max_plays=body.max_plays,
            expires_at=body.expires_at,
            auto_delete_days=auto_delete_days,
            access_user_ids=access_user_ids if access_user_ids else None,
            access_group_ids=body.access_group_ids,
        )

        return JSONResponse(result, status_code=status.HTTP_201_CREATED)

    except ValueError as e:
        return error_response("VALIDATION_ERROR", str(e), status.HTTP_400_BAD_REQUEST)


@router.get("/phrase-sets/{set_id}")
async def get_phrase_set(
    set_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Get a specific phrase set by ID."""
    is_admin = is_admin_or_higher(user)

    result = await db_manager.get_teacher_phrase_set_by_id(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not result:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    # Get phrases
    phrases = await db_manager.get_phrase_set_phrases(set_id)
    result["phrases"] = phrases

    return JSONResponse(result)


@router.put("/phrase-sets/{set_id}")
async def update_phrase_set(
    set_id: int,
    body: UpdatePhraseSetRequest,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Update a phrase set."""
    is_admin = is_admin_or_higher(user)

    try:
        update_data = body.model_dump(exclude_unset=True)
        if "config" in update_data and update_data["config"]:
            update_data["config"] = body.config.model_dump()

        # Handle access_usernames
        if "access_usernames" in update_data:
            usernames = update_data.pop("access_usernames")
            # If access_usernames is provided, we assume we are updating the access list.
            # Start with provided ID list or empty if not provided.
            access_user_ids = update_data.get("access_user_ids") or []

            # Filter provided usernames - must be in teacher's groups
            valid_user_ids = await db_manager.get_users_in_teacher_groups(
                teacher_id=user["id"], usernames=[u.strip() for u in usernames]
            )

            for uid in valid_user_ids:
                if uid not in access_user_ids:
                    access_user_ids.append(uid)

            update_data["access_user_ids"] = access_user_ids

        result = await db_manager.update_teacher_phrase_set(
            set_id=set_id,
            user_id=user["id"],
            is_admin=is_admin,
            **update_data,
        )

        if not result:
            return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

        return JSONResponse(result)

    except ValueError as e:
        return error_response("VALIDATION_ERROR", str(e), status.HTTP_400_BAD_REQUEST)


@router.delete("/phrase-sets/{set_id}")
async def delete_phrase_set(
    set_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Delete a phrase set."""
    is_admin = is_admin_or_higher(user)

    success = await db_manager.delete_teacher_phrase_set(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not success:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    return JSONResponse({"message": "Phrase set deleted"})


@router.post("/phrase-sets/{set_id}/regenerate-link")
async def regenerate_link(
    set_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Regenerate the hotlink token for a phrase set."""
    is_admin = is_admin_or_higher(user)

    result = await db_manager.regenerate_hotlink(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not result:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    return JSONResponse(result)


@router.post("/phrase-sets/{set_id}/extend")
async def extend_auto_delete(
    set_id: int,
    body: ExtendRequest,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Extend the auto-delete date for a phrase set."""
    is_admin = is_admin_or_higher(user)

    new_date = await db_manager.extend_auto_delete(
        set_id=set_id,
        user_id=user["id"],
        days=body.days,
        is_admin=is_admin,
    )

    if new_date is None:
        return error_response(
            "EXTENSION_FAILED",
            "Unable to extend: set not found or has no expiration date",
            status.HTTP_400_BAD_REQUEST,
        )

    return JSONResponse({"auto_delete_at": new_date.isoformat()})


@router.get("/phrase-sets/{set_id}/sessions")
async def list_sessions(
    set_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    completed_only: bool = Query(False),
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """List sessions for a phrase set."""
    is_admin = is_admin_or_higher(user)

    # Verify ownership
    phrase_set = await db_manager.get_teacher_phrase_set_by_id(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not phrase_set:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    result = await db_manager.get_sessions_for_set(
        set_id=set_id,
        limit=limit,
        offset=offset,
        completed_only=completed_only,
    )

    return JSONResponse(result)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Delete a session."""
    await db_manager.delete_session(session_id)
    return JSONResponse({"message": "Session deleted"})


@router.delete("/phrase-sets/{set_id}/sessions")
async def delete_all_sessions(
    set_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Delete all sessions for a phrase set."""
    is_admin = is_admin_or_higher(user)

    # Verify ownership
    phrase_set = await db_manager.get_teacher_phrase_set_by_id(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not phrase_set:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    count = await db_manager.delete_all_sessions_for_set(set_id)

    logger.info(f"Deleted {count} sessions for phrase set {set_id} by user {user['id']}")

    return JSONResponse({"message": f"Deleted {count} sessions", "count": count})


@router.get("/phrase-sets/{set_id}/preview")
async def preview_phrase_set(
    set_id: int,
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Generate a preview grid for a phrase set without creating a session."""
    is_admin = is_admin_or_higher(user)

    # Get the phrase set
    phrase_set = await db_manager.get_teacher_phrase_set_by_id(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not phrase_set:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    # Get phrases
    phrases = await db_manager.get_phrase_set_phrases(set_id)

    if not phrases:
        return error_response("NO_PHRASES", "Phrase set has no phrases", status.HTTP_400_BAD_REQUEST)

    # Ensure phrases have translation field
    phrases_for_grid = []
    for p in phrases:
        phrase_data = dict(p)
        if "translation" not in phrase_data:
            phrase_data["translation"] = ""
        phrases_for_grid.append(phrase_data)

    # Get grid size from config
    config = phrase_set.get("config", {})
    grid_size = config.get("grid_size", 10)

    # Generate grid
    grid, placed_phrases = generate_grid(phrases_for_grid, size=grid_size)

    return JSONResponse(
        {
            "grid": grid,
            "phrases": placed_phrases,
            "config": config,
        }
    )


@router.get("/phrase-sets/{set_id}/export")
async def export_sessions(
    set_id: int,
    format: str = Query("csv", pattern="^(csv|json)$"),
    user: dict = Depends(require_teacher_access),
) -> JSONResponse:
    """Export session data for a phrase set."""
    import csv
    from io import StringIO

    is_admin = is_admin_or_higher(user)

    # Verify ownership
    phrase_set = await db_manager.get_teacher_phrase_set_by_id(
        set_id=set_id,
        user_id=user["id"],
        is_admin=is_admin,
    )

    if not phrase_set:
        return error_response("SET_NOT_FOUND", "Phrase set not found", status.HTTP_404_NOT_FOUND)

    # Get all sessions (no pagination for export)
    result = await db_manager.get_sessions_for_set(
        set_id=set_id,
        limit=1000,
        offset=0,
        completed_only=False,
    )

    sessions = result.get("sessions", [])

    if format == "json":
        return JSONResponse(
            {
                "phrase_set": {
                    "id": phrase_set["id"],
                    "name": phrase_set["name"],
                },
                "sessions": sessions,
                "total": len(sessions),
            }
        )

    # CSV format
    output = StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(
        [
            "Nickname",
            "Phrases Found",
            "Total Phrases",
            "Duration (seconds)",
            "Completed",
            "Started At",
            "Completed At",
        ]
    )

    # Data rows
    for session in sessions:
        writer.writerow(
            [
                session.get("nickname", ""),
                session.get("phrases_found", 0),
                session.get("total_phrases", 0),
                session.get("duration_seconds", ""),
                "Yes" if session.get("is_completed") else "No",
                session.get("started_at", ""),
                session.get("completed_at", ""),
            ]
        )

    csv_content = output.getvalue()
    output.close()

    # Return CSV with proper headers
    from fastapi.responses import Response

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{phrase_set["name"]}_sessions.csv"'},
    )


# ============================================================================
# Public Hotlink Endpoints
# ============================================================================


@router.get("/set/{token}")
async def get_set_by_token(
    token: str,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> JSONResponse:
    """Validate hotlink and get phrase set data."""
    user_id = user["id"] if user else None

    result = await db_manager.validate_hotlink_access(
        token=token,
        user_id=user_id,
    )

    if "error" in result:
        error = result["error"]
        code = error["code"]

        status_map = {
            "SET_NOT_FOUND": status.HTTP_404_NOT_FOUND,
            "SET_EXPIRED": status.HTTP_410_GONE,
            "SET_INACTIVE": status.HTTP_410_GONE,
            "SET_EXHAUSTED": status.HTTP_410_GONE,
            "AUTH_REQUIRED": status.HTTP_401_UNAUTHORIZED,
            "ACCESS_DENIED": status.HTTP_403_FORBIDDEN,
        }

        return error_response(
            code,
            error["message"],
            status_map.get(code, status.HTTP_400_BAD_REQUEST),
            error.get("details"),
        )

    return JSONResponse(result)


@router.post("/set/{token}/start")
async def start_session(
    token: str,
    body: StartSessionRequest,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> JSONResponse:
    """Start a new game session."""
    user_id = user["id"] if user else None

    # Validate access first
    validation = await db_manager.validate_hotlink_access(
        token=token,
        user_id=user_id,
    )

    if "error" in validation:
        error = validation["error"]
        return error_response(
            error["code"],
            error["message"],
            status.HTTP_400_BAD_REQUEST,
        )

    phrase_set = validation["set"]

    # Determine nickname
    if user:
        # Logged-in user: use their username
        nickname = user["username"]
    else:
        # Anonymous: nickname required
        if not body.nickname:
            return error_response(
                "NICKNAME_REQUIRED",
                "Nickname is required for anonymous play",
                status.HTTP_400_BAD_REQUEST,
            )
        nickname = body.nickname

    # Determine grid size
    config = phrase_set.get("config", {})
    if config.get("strict_grid_size"):
        grid_size = config.get("grid_size", 10)
    else:
        grid_size = body.grid_size or config.get("grid_size", 10)

    # Generate grid with phrases first to get actual placed count
    phrases_for_grid = []
    for p in phrase_set.get("phrases", []):
        phrase_data = dict(p)
        if "translation" not in phrase_data:
            phrase_data["translation"] = ""  # Default empty translation
        phrases_for_grid.append(phrase_data)

    grid, placed_phrases = generate_grid(phrases_for_grid, size=grid_size)

    # Create session with actual placed phrase count (not original list length)
    session = await db_manager.create_session(
        set_id=phrase_set["id"],
        nickname=nickname,
        grid_size=grid_size,
        difficulty=config.get("difficulty", "medium"),
        total_phrases=len(placed_phrases),  # Use placed count, not original
        hotlink_version=phrase_set["hotlink_version"],
        user_id=user_id,
    )

    # Return session info with grid and phrases
    return JSONResponse(
        {
            "session_token": session["session_token"],
            "grid": grid,
            "phrases": placed_phrases,  # Contains coords for each phrase
            "config": config,
            "grid_size": grid_size,
        },
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/set/{token}/complete")
async def complete_session(
    token: str,
    body: CompleteSessionRequest,
) -> JSONResponse:
    """Complete a game session."""
    result = await db_manager.complete_session(
        session_token=body.session_token,
        phrases_found=body.phrases_found,
        duration_seconds=body.duration_seconds,
        translation_submissions=body.translation_submissions,
    )

    if result is None:
        return error_response(
            "SESSION_INVALID",
            "Session not found",
            status.HTTP_400_BAD_REQUEST,
        )

    if "error" in result:
        return error_response(
            result["error"]["code"],
            result["error"]["message"],
            status.HTTP_400_BAD_REQUEST,
        )

    return JSONResponse(result)


@router.get("/session/{session_token}")
async def get_session_status(
    session_token: str,
) -> JSONResponse:
    """Get session status (for recovery after refresh)."""
    session = await db_manager.get_session_by_token(session_token)

    if not session:
        return error_response(
            "SESSION_INVALID",
            "Session not found",
            status.HTTP_404_NOT_FOUND,
        )

    return JSONResponse(session)
