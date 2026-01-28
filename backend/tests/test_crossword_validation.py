import pytest
from osmosmjerka.grid_generator.crossword_generator import generate_crossword_grid


def test_crossword_min_phrases_validation():
    """Test that generator raises ValueError if not enough phrases are available/placed."""
    # Size 10 grid requires (10 // 2) + 1 = 6 phrases
    size = 10
    min_needed = 6

    # 1. Input list too small (though generator normally filters first,
    # we simulate the check inside generation if we pass it manually)

    # Create dummy phrases
    phrases = [{"phrase": f"WORD{i}", "translation": f"TRANS{i}"} for i in range(min_needed - 1)]

    # The generator post-check validates placed_phrases.
    # Even if we pass 5 phrases to a size 10 grid, it might place them all,
    # but 5 < 6, so it should raise ValueError.

    with pytest.raises(ValueError) as excinfo:
        generate_crossword_grid(phrases, size=size)

    assert "Could not place enough phrases" in str(excinfo.value)
    assert f"Needed {min_needed}" in str(excinfo.value)


def test_crossword_unplaceable_phrases_validation():
    """Test that validation fails if phrases are provided but cannot be placed."""
    size = 10

    # Provide enough phrases (e.g. 7), but make them incompatible (no common letters)
    # ZZZ, YYY, XXX...
    vocab = ["ZZZZZ", "YYYYY", "XXXXX", "WWWWW", "VVVVV", "UUUUU", "TTTTT"]
    phrases = [{"phrase": w, "translation": w} for w in vocab]

    # The generator will place the first one, then fail to intersect the rest.
    # placed_phrases count will be 1 (or 0 if even first fails? first always succeeds).
    # 1 < 6 -> ValueError.

    with pytest.raises(ValueError) as excinfo:
        generate_crossword_grid(phrases, size=size)

    assert "Could not place enough phrases" in str(excinfo.value)
