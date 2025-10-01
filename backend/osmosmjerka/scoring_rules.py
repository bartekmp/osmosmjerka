"""Shared scoring rules configuration for Osmosmjerka.

This module centralises all scoring-related constants so that both the
backend scoring logic and any public endpoints can rely on a single
source of truth. The values defined here should remain simple data
structures (numbers, dictionaries, lists) to make it easy to expose them
via JSON APIs or reuse them in other contexts.
"""

from __future__ import annotations

from typing import Dict, List

# Base configuration values -------------------------------------------------

BASE_POINTS_PER_PHRASE: int = 100
"""Number of points awarded for each found phrase."""

DIFFICULTY_MULTIPLIERS: Dict[str, float] = {
    "very_easy": 0.8,
    "easy": 1.0,
    "medium": 1.2,
    "hard": 1.5,
    "very_hard": 2.0,
}
"""Multiplier applied to the base score depending on puzzle difficulty."""

# Maximum percentage (expressed as a ratio) of the base score that can be
# awarded as a speed bonus when a puzzle is completed quickly.
MAX_TIME_BONUS_RATIO: float = 0.3

# Target completion times per difficulty level in seconds. Finishing at or
# below these thresholds yields the highest speed bonus for that difficulty.
TARGET_TIMES_SECONDS: Dict[str, int] = {
    "very_easy": 240,  # 4 minutes
    "easy": 300,  # 5 minutes
    "medium": 600,  # 10 minutes
    "hard": 900,  # 15 minutes
    "very_hard": 1200,  # 20 minutes
}

# Bonus for completing the entire puzzle (finding every phrase).
COMPLETION_BONUS_POINTS: int = 200

# Points deducted for each hint the player uses.
HINT_PENALTY_PER_HINT: int = 75

# Public representation ------------------------------------------------------

DIFFICULTY_ORDER: List[str] = ["very_easy", "easy", "medium", "hard", "very_hard"]
"""Default ordering for displaying difficulty-related data."""

SCORING_RULES: Dict[str, object] = {
    "base_points_per_phrase": BASE_POINTS_PER_PHRASE,
    "difficulty_multipliers": DIFFICULTY_MULTIPLIERS,
    "difficulty_order": DIFFICULTY_ORDER,
    "time_bonus": {
        "max_ratio": MAX_TIME_BONUS_RATIO,
        "target_times_seconds": TARGET_TIMES_SECONDS,
    },
    "completion_bonus_points": COMPLETION_BONUS_POINTS,
    "hint_penalty_per_hint": HINT_PENALTY_PER_HINT,
}
"""Structured scoring rules ready to be serialised or shared."""


def get_scoring_rules() -> Dict[str, object]:
    """Return a copy of the scoring rules for external consumers."""
    # Return a shallow copy at the top level to guard against accidental
    # mutation by callers. Nested structures remain shared intentionally to
    # avoid unnecessary deep copies, but callers should treat them as
    # read-only.
    return dict(SCORING_RULES)


__all__ = [
    "BASE_POINTS_PER_PHRASE",
    "COMPLETION_BONUS_POINTS",
    "DIFFICULTY_MULTIPLIERS",
    "DIFFICULTY_ORDER",
    "HINT_PENALTY_PER_HINT",
    "MAX_TIME_BONUS_RATIO",
    "SCORING_RULES",
    "TARGET_TIMES_SECONDS",
    "get_scoring_rules",
]
