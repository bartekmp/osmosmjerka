"""Unit tests for the forgiving daily streak logic (osmosmjerka/streak.py)."""

import datetime

from osmosmjerka.streak import (
    DEFAULT_FREEZES,
    FREEZE_REGAIN_EVERY,
    MAX_FREEZES,
    StreakState,
    register_activity,
)

D = datetime.date


def test_first_activity_starts_streak():
    r = register_activity(StreakState(), D(2026, 7, 2))
    assert r.current == 1 and r.longest == 1 and r.changed
    assert r.last_active == D(2026, 7, 2)
    assert r.freezes == DEFAULT_FREEZES


def test_same_day_is_idempotent():
    state = StreakState(current=3, longest=3, last_active=D(2026, 7, 2), freezes=2)
    r = register_activity(state, D(2026, 7, 2))
    assert not r.changed
    assert r.current == 3 and r.freezes == 2


def test_consecutive_day_increments():
    state = StreakState(current=3, longest=5, last_active=D(2026, 7, 2), freezes=2)
    r = register_activity(state, D(2026, 7, 3))
    assert r.current == 4 and r.changed
    assert r.longest == 5  # unchanged (4 < 5)
    assert r.freezes == 2


def test_one_missed_day_forgiven_by_freeze():
    state = StreakState(current=4, longest=4, last_active=D(2026, 7, 2), freezes=2)
    r = register_activity(state, D(2026, 7, 4))  # missed 07-03
    assert r.current == 5  # streak continues
    assert r.freezes == 1  # one freeze consumed
    assert r.longest == 5


def test_too_many_missed_days_resets():
    state = StreakState(current=10, longest=10, last_active=D(2026, 7, 2), freezes=1)
    r = register_activity(state, D(2026, 7, 6))  # missed 3 days, only 1 freeze
    assert r.current == 1
    assert r.freezes == 1  # freezes untouched on reset
    assert r.longest == 10  # longest preserved


def test_missed_days_equal_freezes_forgiven():
    state = StreakState(current=8, longest=8, last_active=D(2026, 7, 2), freezes=2)
    r = register_activity(state, D(2026, 7, 5))  # missed 2 days, have 2 freezes
    assert r.current == 9
    assert r.freezes == 0


def test_freeze_regained_at_milestone():
    # reaching a multiple of FREEZE_REGAIN_EVERY grants a freeze back (capped)
    state = StreakState(
        current=FREEZE_REGAIN_EVERY - 1, longest=FREEZE_REGAIN_EVERY - 1, last_active=D(2026, 7, 2), freezes=0
    )
    r = register_activity(state, D(2026, 7, 3))
    assert r.current == FREEZE_REGAIN_EVERY
    assert r.freezes == 1


def test_freeze_regain_capped_at_max():
    state = StreakState(
        current=FREEZE_REGAIN_EVERY - 1, longest=99, last_active=D(2026, 7, 2), freezes=MAX_FREEZES
    )
    r = register_activity(state, D(2026, 7, 3))
    assert r.freezes == MAX_FREEZES  # not exceeded


def test_longest_tracks_peak():
    state = StreakState(current=6, longest=6, last_active=D(2026, 7, 2), freezes=2)
    r = register_activity(state, D(2026, 7, 3))
    assert r.current == 7 and r.longest == 7
