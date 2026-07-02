"""Learning / spaced-repetition endpoints.

Phase 1 of the learning modes: the puzzle screens' "Training" toggle posts a
self-assessed grade per word to :func:`submit_review`, which advances that word's SRS
schedule. Stats and due-item endpoints back the (later) review dashboard.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from osmosmjerka.auth import get_current_user
from osmosmjerka.database import db_manager
from osmosmjerka.logging_config import get_logger
from pydantic import BaseModel, Field, model_validator

logger = get_logger(__name__)

router = APIRouter()


class ReviewRequest(BaseModel):
    """One self-assessed review of a single word.

    Provide exactly one of ``phrase_id`` (public phrase) or ``list_phrase_id`` (custom
    private-list phrase).
    """

    language_set_id: int
    direction: Literal["production", "recognition"]
    grade: Literal["again", "good", "easy"]
    phrase_id: Optional[int] = None
    list_phrase_id: Optional[int] = Field(default=None)

    @model_validator(mode="after")
    def _exactly_one_ref(self) -> "ReviewRequest":
        if (self.phrase_id is None) == (self.list_phrase_id is None):
            raise ValueError("Provide exactly one of phrase_id or list_phrase_id")
        return self


@router.post("/learn/review")
async def submit_review(body: ReviewRequest, user=Depends(get_current_user)) -> JSONResponse:
    """Record a self-assessed review and return the item's updated mastery/schedule."""
    try:
        result = await db_manager.record_review(
            user_id=user["id"],
            language_set_id=body.language_set_id,
            direction=body.direction,
            grade=body.grade,
            phrase_id=body.phrase_id,
            list_phrase_id=body.list_phrase_id,
        )
        return JSONResponse(result)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception:
        logger.exception("Failed to record review")
        return JSONResponse({"error": "Failed to record review"}, status_code=500)


@router.get("/learn/stats")
async def get_learn_stats(language_set_id: Optional[int] = Query(None), user=Depends(get_current_user)) -> JSONResponse:
    """Tracked / due / mastered counts for the current user."""
    try:
        stats = await db_manager.get_mastery_stats(user["id"], language_set_id)
        return JSONResponse(stats)
    except Exception:
        logger.exception("Failed to get mastery stats")
        return JSONResponse({"error": "Failed to get mastery stats"}, status_code=500)


@router.get("/learn/streak")
async def get_streak(user=Depends(get_current_user)) -> JSONResponse:
    """Current forgiving daily streak (current / longest / freezes)."""
    try:
        return JSONResponse(await db_manager.get_streak(user["id"]))
    except Exception:
        logger.exception("Failed to get streak")
        return JSONResponse({"error": "Failed to get streak"}, status_code=500)


@router.get("/learn/due")
async def get_due(
    language_set_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Items whose review is due now (soonest first) — backs the review sprint."""
    try:
        items = await db_manager.get_due_items(user["id"], language_set_id, limit)
        return JSONResponse(items)
    except Exception:
        logger.exception("Failed to get due items")
        return JSONResponse({"error": "Failed to get due items"}, status_code=500)
