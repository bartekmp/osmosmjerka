"""Spaced-repetition scheduling (SM-2-lite).

Pure functions, no database — so they are trivial to unit test. The learning modes
call :func:`schedule` with an item's current mastery state and a self-assessed grade and
get back the updated scheduling state (ease, interval, due offset, reps, lapses, mastery
bucket). The DB layer turns ``due_in_seconds`` into an absolute ``due_at``.

Grades come from the 3-button confidence UI (see srs-design-decisions):

    AGAIN  (❌ "didn't know")   -> failed recall; relearn soon, ease down
    GOOD   (🤔 "shaky/knew it") -> a normal pass
    EASY   (✅ "knew it")       -> confident pass; longer interval, ease up

Fields (ease/interval_days/reps/lapses/due) mirror Anki's model on purpose so a future
Anki import/export maps cleanly.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

# --- tunables (kept here; can move to a settings row later) -------------------
EASE_DEFAULT = 2.5
EASE_MIN = 1.3
EASE_AGAIN_DELTA = -0.20
EASE_EASY_DELTA = 0.15
FIRST_INTERVAL_DAYS = 1.0
SECOND_INTERVAL_DAYS = 6.0
EASY_BONUS = 1.3
RELEARN_MINUTES = 10  # after a lapse, resurface within the same session
SECONDS_PER_DAY = 86400

# interval thresholds (days) that bump the 0..5 mastery bucket used for UI
MASTERY_THRESHOLDS_DAYS = (1, 7, 21, 60, 180)


class Grade(str, Enum):
    AGAIN = "again"
    GOOD = "good"
    EASY = "easy"

    @property
    def passed(self) -> bool:
        return self is not Grade.AGAIN


@dataclass(frozen=True)
class MasteryState:
    """Current scheduling state of one item (for one user, one direction)."""

    ease: float = EASE_DEFAULT
    interval_days: float = 0.0
    reps: int = 0
    lapses: int = 0


@dataclass(frozen=True)
class ScheduleResult:
    ease: float
    interval_days: float
    reps: int
    lapses: int
    due_in_seconds: float  # offset from "now" to the next due time
    mastery_level: int  # 0..5, derived from interval_days


def mastery_level(interval_days: float) -> int:
    """Bucket an interval into a 0..5 mastery level for display."""
    return sum(1 for threshold in MASTERY_THRESHOLDS_DAYS if interval_days >= threshold)


def schedule(state: MasteryState, grade: Grade) -> ScheduleResult:
    """Apply a grade to the current state and return the next scheduling state."""
    ease = state.ease
    interval = state.interval_days
    reps = state.reps
    lapses = state.lapses

    if grade is Grade.AGAIN:
        ease = max(EASE_MIN, ease + EASE_AGAIN_DELTA)
        reps = 0
        lapses += 1
        interval = 0.0
        due_in_seconds = float(RELEARN_MINUTES * 60)
    else:
        if grade is Grade.EASY:
            ease = ease + EASE_EASY_DELTA

        if reps == 0:
            interval = FIRST_INTERVAL_DAYS
        elif reps == 1:
            interval = SECOND_INTERVAL_DAYS
        else:
            interval = interval * ease

        if grade is Grade.EASY:
            interval = interval * EASY_BONUS

        reps += 1
        due_in_seconds = interval * SECONDS_PER_DAY

    return ScheduleResult(
        ease=round(max(EASE_MIN, ease), 4),
        interval_days=round(interval, 4),
        reps=reps,
        lapses=lapses,
        due_in_seconds=due_in_seconds,
        mastery_level=mastery_level(interval),
    )


def suggested_grade(hints_used: int, response_ms: int | None = None, slow_ms: int = 12000) -> Grade:
    """Heuristic default for the 3-button UI (the user can always override).

    Any hint means the answer wasn't fully recalled -> suggest GOOD (not EASY). A slow
    but hint-free answer also suggests GOOD. A fast, hint-free answer suggests EASY.
    This only pre-selects a button; it is never the authoritative grade.
    """
    if hints_used > 0:
        return Grade.GOOD
    if response_ms is not None and response_ms > slow_ms:
        return Grade.GOOD
    return Grade.EASY
