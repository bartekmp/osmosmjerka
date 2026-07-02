"""Unit tests for the SM-2-lite spaced-repetition scheduler (osmosmjerka/srs.py)."""

from osmosmjerka.srs import (
    EASE_DEFAULT,
    EASE_MIN,
    EASY_BONUS,
    FIRST_INTERVAL_DAYS,
    RELEARN_MINUTES,
    SECOND_INTERVAL_DAYS,
    Grade,
    MasteryState,
    mastery_level,
    schedule,
    suggested_grade,
)


def test_new_item_good_first_interval():
    r = schedule(MasteryState(), Grade.GOOD)
    assert r.interval_days == FIRST_INTERVAL_DAYS
    assert r.reps == 1
    assert r.lapses == 0
    assert r.ease == EASE_DEFAULT
    assert r.due_in_seconds == FIRST_INTERVAL_DAYS * 86400
    assert r.mastery_level == 1


def test_new_item_easy_gets_bonus_and_ease_up():
    r = schedule(MasteryState(), Grade.EASY)
    # first interval (1) * easy bonus (1.3)
    assert r.interval_days == round(FIRST_INTERVAL_DAYS * EASY_BONUS, 4)
    assert r.ease == round(EASE_DEFAULT + 0.15, 4)
    assert r.reps == 1


def test_second_good_uses_fixed_six_days():
    r = schedule(MasteryState(reps=1, interval_days=1.0), Grade.GOOD)
    assert r.interval_days == SECOND_INTERVAL_DAYS
    assert r.reps == 2


def test_mature_good_multiplies_by_ease():
    state = MasteryState(reps=3, interval_days=10.0, ease=2.5)
    r = schedule(state, Grade.GOOD)
    assert r.interval_days == 25.0  # 10 * 2.5
    assert r.reps == 4


def test_again_lapses_and_resets():
    state = MasteryState(reps=4, interval_days=30.0, ease=2.5, lapses=1)
    r = schedule(state, Grade.AGAIN)
    assert r.reps == 0
    assert r.lapses == 2
    assert r.interval_days == 0.0
    assert r.ease == round(2.5 - 0.20, 4)
    assert r.due_in_seconds == RELEARN_MINUTES * 60
    assert r.mastery_level == 0


def test_ease_never_below_floor():
    state = MasteryState(ease=EASE_MIN)
    r = schedule(state, Grade.AGAIN)
    assert r.ease == EASE_MIN  # clamped, not 1.1


def test_repeated_again_stays_at_floor():
    state = MasteryState(ease=1.4)
    r1 = schedule(state, Grade.AGAIN)
    r2 = schedule(MasteryState(ease=r1.ease), Grade.AGAIN)
    assert r1.ease == EASE_MIN
    assert r2.ease == EASE_MIN


def test_mastery_level_buckets():
    assert mastery_level(0) == 0
    assert mastery_level(0.5) == 0
    assert mastery_level(1) == 1
    assert mastery_level(6) == 1
    assert mastery_level(7) == 2
    assert mastery_level(21) == 3
    assert mastery_level(60) == 4
    assert mastery_level(180) == 5
    assert mastery_level(999) == 5


def test_grade_passed_property():
    assert Grade.GOOD.passed
    assert Grade.EASY.passed
    assert not Grade.AGAIN.passed


def test_suggested_grade_from_signals():
    assert suggested_grade(hints_used=0, response_ms=1000) is Grade.EASY
    assert suggested_grade(hints_used=1, response_ms=1000) is Grade.GOOD  # any hint -> not easy
    assert suggested_grade(hints_used=0, response_ms=20000) is Grade.GOOD  # slow -> not easy
    assert suggested_grade(hints_used=0, response_ms=None) is Grade.EASY


def test_growth_sequence_reaches_mature():
    """A few consecutive GOOD reviews should grow the interval into maturity."""
    state = MasteryState()
    for _ in range(6):
        r = schedule(state, Grade.GOOD)
        state = MasteryState(ease=r.ease, interval_days=r.interval_days, reps=r.reps, lapses=r.lapses)
    assert state.interval_days > 21  # matured past the level-3 threshold
    assert r.mastery_level >= 3
