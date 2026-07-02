"""Forgiving daily streak logic (pure, no DB — easy to unit test).

A "day" counts once the user does at least one review. Missing a day doesn't
necessarily break the streak: each missed day can be covered by a **freeze** token, and
freezes are slowly regained the longer the streak runs. This is the low-guilt, habit-
building streak from the design notes (srs-design-decisions), not the per-puzzle
`streak_bonus` (which is really a completion bonus).
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass

DEFAULT_FREEZES = 2  # forgiveness tokens a new user starts with
MAX_FREEZES = 3
FREEZE_REGAIN_EVERY = 7  # earn a freeze back every N days of an unbroken streak


@dataclass(frozen=True)
class StreakState:
    current: int = 0
    longest: int = 0
    last_active: datetime.date | None = None
    freezes: int = DEFAULT_FREEZES


@dataclass(frozen=True)
class StreakResult:
    current: int
    longest: int
    last_active: datetime.date
    freezes: int
    changed: bool  # True if `today` counted as a newly-active day


def register_activity(state: StreakState, today: datetime.date) -> StreakResult:
    """Register one day of activity and return the updated streak."""
    la = state.last_active

    # Already counted today (or a clock anomaly) — nothing changes.
    if la is not None and today <= la:
        return StreakResult(state.current, state.longest, la, state.freezes, changed=False)

    if la is None:
        current, freezes = 1, state.freezes
    else:
        gap = (today - la).days
        if gap == 1:
            current, freezes = state.current + 1, state.freezes
        else:
            missed = gap - 1
            if missed <= state.freezes:
                # forgiven: consume one freeze per missed day, streak continues
                current, freezes = state.current + 1, state.freezes - missed
            else:
                # too many missed days — streak resets
                current, freezes = 1, state.freezes

    # regain a freeze at each milestone of an unbroken streak
    if current > 0 and current % FREEZE_REGAIN_EVERY == 0 and freezes < MAX_FREEZES:
        freezes += 1

    longest = max(state.longest, current)
    return StreakResult(current, longest, today, freezes, changed=True)
