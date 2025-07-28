import pytest

from osmosmjerka.grid_generator import generate_grid, normalize_word


def test_empty_words():
    grid, placed = generate_grid([])
    assert grid == []
    assert placed == []


def test_all_words_too_short():
    words = [{"word": "a", "translation": "A"}, {"word": "b", "translation": "B"}]
    grid, placed = generate_grid(words)
    assert grid == []
    assert placed == []


def test_single_word():
    words = [{"word": "TEST", "translation": "PRÓBA"}]
    grid, placed = generate_grid(words, size=6)
    assert len(grid) == 6
    assert len(grid[0]) == 6
    assert any("T" in row for row in grid)
    assert placed[0]["word"] == "TEST"
    assert placed[0]["translation"] == "PRÓBA"
    assert len(placed[0]["coords"]) == 4


def test_word_with_spaces():
    words = [{"word": "HELLO WORLD", "translation": "CZEŚĆ ŚWIECIE"}]
    grid, placed = generate_grid(words)
    coords = placed[0]["coords"]
    assert len(coords) == len("HELLOWORLD")
    letters = [grid[r][c] for r, c in coords]
    assert "".join(letters) == "HELLOWORLD"


def test_word_longer_than_grid():
    words = [{"word": "LONGWORD", "translation": "DLUGIESLOWO"}]
    grid, placed = generate_grid(words, size=3)
    assert placed == []
    assert all(len(row) == 3 for row in grid)


def test_multiple_words_no_overlap():
    words = [
        {"word": "CAT", "translation": "KOT"},
        {"word": "DOG", "translation": "PIES"},
        {"word": "BIRD", "translation": "PTAK"},
    ]
    grid, placed = generate_grid(words, size=7)
    assert len(placed) == 3
    for word in words:
        assert any(p["word"] == word["word"] for p in placed)


def test_fill_empty_cells():
    words = [{"word": "PYTHON", "translation": "WĄŻ"}]
    grid, placed = generate_grid(words, size=8)
    for row in grid:
        for cell in row:
            assert cell.isupper() and len(cell) == 1


def test_randomness_of_grid(monkeypatch):
    # Patch random.choice to always return 'X'
    import random

    monkeypatch.setattr(random, "choice", lambda seq: "X")
    words = [{"word": "PY", "translation": "PI"}]
    grid, placed = generate_grid(words, size=4)
    for row in grid:
        for cell in row:
            assert cell in ("P", "Y", "X")


def test_no_conflict_on_overlap():
    words = [
        {"word": "CROSS", "translation": "KRZYŻ"},
        {"word": "ROSS", "translation": "ROSS"},
    ]
    grid, placed = generate_grid(words, size=7)
    assert any(p["word"] == "CROSS" for p in placed)
    assert any(p["word"] == "ROSS" for p in placed)


def test_translation_is_preserved():
    words = [{"word": "APPLE", "translation": "JABŁKO"}]
    _, placed = generate_grid(words)
    assert placed[0]["translation"] == "JABŁKO"


def test_normalize_word_basic():
    assert normalize_word("hello") == "HELLO"
    assert normalize_word("Hello World") == "HELLOWORLD"
    assert normalize_word("Hello-World") == "HELLO-WORLD"
    assert normalize_word("Hello, World!") == "HELLOWORLD"
    assert normalize_word("-Hello-") == "HELLO"
    assert normalize_word("--Hello--") == "HELLO"


def test_normalize_word_croatian():
    assert normalize_word("čćžšđ") == "ČĆŽŠĐ"
    assert normalize_word("Čaša-Đak!") == "ČAŠA-ĐAK"
    assert normalize_word("prijatelj!") == "PRIJATELJ"
    assert normalize_word("životinja, pas!") == "ŽIVOTINJAPAS"
    assert normalize_word("-čćžšđ-") == "ČĆŽŠĐ"


def test_normalize_word_mixed():
    assert normalize_word("A-b_c!č") == "A-BCČ"
    assert normalize_word("123-abc-ČĆ") == "ABC-ČĆ"
    assert normalize_word("!@#-čćž-") == "ČĆŽ"
    assert normalize_word("") == ""
