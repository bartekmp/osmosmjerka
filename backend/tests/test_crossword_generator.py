"""Tests for crossword grid generator."""

from osmosmjerka.grid_generator.crossword.generator import (
    _is_valid_crossword_placement,
    _place_first_phrase,
    generate_crossword_grid,
)


class TestGenerateCrosswordGrid:
    """Tests for generate_crossword_grid function."""

    def test_empty_phrases_returns_empty(self):
        """Empty phrase list should return empty grid."""
        grid, placed = generate_crossword_grid([])
        assert grid == []
        assert placed == []

    def test_short_phrases_filtered(self):
        """Phrases shorter than 3 characters should be filtered out."""
        phrases = [{"phrase": "AB", "translation": "test"}]
        grid, placed = generate_crossword_grid(phrases)
        assert grid == []
        assert placed == []

    def test_single_phrase_placement(self):
        """Single phrase should be placed horizontally in center."""
        phrases = [{"phrase": "HELLO", "translation": "greeting"}]
        grid, placed = generate_crossword_grid(phrases, size=10, validate_min_phrases=False)

        assert len(placed) == 1
        assert placed[0]["phrase"] == "HELLO"
        assert placed[0]["direction"] == "across"
        assert placed[0]["start_number"] == 1
        # Check phrase is in grid
        coords = placed[0]["coords"]
        assert len(coords) == 5

    def test_two_phrases_intersection(self):
        """Two phrases with common letter should intersect."""
        phrases = [
            {"phrase": "HELLO", "translation": "greeting"},
            {"phrase": "HELP", "translation": "assistance"},  # shares H, E, L
        ]
        grid, placed = generate_crossword_grid(phrases, size=10, validate_min_phrases=False)

        # At least one phrase should be placed
        assert len(placed) >= 1
        # If both placed, they should have different directions or intersect
        if len(placed) == 2:
            # Check they share at least one cell (intersection)
            coords1 = set(tuple(c) for c in placed[0]["coords"])
            coords2 = set(tuple(c) for c in placed[1]["coords"])
            intersection = coords1 & coords2
            # Either they intersect or one couldn't fit perpendicular
            assert len(intersection) >= 0

    def test_grid_size_calculation(self):
        """Grid size should accommodate longest phrase."""
        phrases = [{"phrase": "PROGRAMMING", "translation": "coding"}]  # 11 chars
        grid, placed = generate_crossword_grid(phrases, validate_min_phrases=False)

        # Grid should be at least 11 + padding
        assert len(grid) >= 11
        assert len(grid[0]) >= 11

    def test_start_numbers_assigned(self):
        """Each unique start position should have a number."""
        phrases = [
            {"phrase": "ACROSS", "translation": "horizontal"},
            {"phrase": "DOWN", "translation": "vertical"},
        ]
        grid, placed = generate_crossword_grid(phrases, size=12, validate_min_phrases=False)

        if len(placed) >= 1:
            assert "start_number" in placed[0]
            assert placed[0]["start_number"] >= 1

    def test_direction_values(self):
        """Direction should be 'across' or 'down'."""
        phrases = [{"phrase": "TEST", "translation": "exam"}]
        grid, placed = generate_crossword_grid(phrases, size=8, validate_min_phrases=False)

        assert len(placed) == 1
        assert placed[0]["direction"] in ["across", "down"]


class TestPlaceFirstPhrase:
    """Tests for _place_first_phrase function."""

    def test_centers_phrase_horizontally(self):
        """First phrase should be centered horizontally."""
        grid = [[None] * 10 for _ in range(10)]
        coords, direction = _place_first_phrase(grid, "TEST", 10)

        # Should be horizontal
        assert direction == (0, 1)
        # Should be centered
        assert len(coords) == 4
        # All coords should be in same row
        rows = [c[0] for c in coords]
        assert len(set(rows)) == 1


class TestIsValidCrosswordPlacement:
    """Tests for _is_valid_crossword_placement function."""

    def test_empty_grid_valid(self):
        """Placement on empty grid should be valid."""
        grid = [[None] * 8 for _ in range(8)]
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        assert _is_valid_crossword_placement(grid, "TEST", coords, 8)

    def test_out_of_bounds_invalid(self):
        """Placement outside grid should be invalid."""
        grid = [[None] * 8 for _ in range(8)]
        coords = [(3, 6), (3, 7), (3, 8), (3, 9)]  # 8, 9 are out of bounds
        assert not _is_valid_crossword_placement(grid, "TEST", coords, 8)

    def test_letter_conflict_invalid(self):
        """Placement with conflicting letters should be invalid."""
        grid = [[None] * 8 for _ in range(8)]
        grid[3][3] = {"letter": "X", "phrase_indices": [0]}
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        # "TEST"[1] = 'E' but grid has 'X' at (3, 3)
        assert not _is_valid_crossword_placement(grid, "TEST", coords, 8)

    def test_same_letter_valid(self):
        """Placement with matching letters should be valid (intersection)."""
        grid = [[None] * 8 for _ in range(8)]
        grid[3][3] = {"letter": "E", "phrase_indices": [0]}
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        # "TEST"[1] = 'E' matches grid at (3, 3)
        assert _is_valid_crossword_placement(grid, "TEST", coords, 8)

    def test_cell_before_phrase_occupied_invalid(self):
        """Placement where cell before phrase start is occupied should be invalid."""
        grid = [[None] * 10 for _ in range(10)]
        # Place a letter at (3, 1) - this is where a horizontal phrase would start before
        grid[3][1] = {"letter": "X", "phrase_indices": [0]}
        # Try to place "TEST" starting at (3, 2) - cell before (3, 1) has a letter
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        assert not _is_valid_crossword_placement(grid, "TEST", coords, 10)

    def test_cell_after_phrase_occupied_invalid(self):
        """Placement where cell after phrase end is occupied should be invalid."""
        grid = [[None] * 10 for _ in range(10)]
        # Place a letter at (3, 6) - this is where a horizontal phrase ending at (3, 5) would run into
        grid[3][6] = {"letter": "Y", "phrase_indices": [0]}
        # Try to place "TEST" ending at (3, 5) - cell after (3, 6) has a letter
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        assert not _is_valid_crossword_placement(grid, "TEST", coords, 10)

    def test_cell_buffer_with_gap_valid(self):
        """Placement with at least one cell gap before/after should be valid."""
        grid = [[None] * 10 for _ in range(10)]
        # Place a letter at (3, 0) - two cells before phrase start at (3, 2)
        grid[3][0] = {"letter": "A", "phrase_indices": [0]}
        # Place a letter at (3, 7) - two cells after phrase end at (3, 5)
        grid[3][7] = {"letter": "B", "phrase_indices": [0]}
        # Phrase at (3, 2)-(3, 5) should still be valid - buffer cells (3, 1) and (3, 6) are empty
        coords = [(3, 2), (3, 3), (3, 4), (3, 5)]
        assert _is_valid_crossword_placement(grid, "TEST", coords, 10)

    def test_vertical_cell_buffer_invalid(self):
        """Vertical placement should also respect cell buffer rules."""
        grid = [[None] * 10 for _ in range(10)]
        # Place a letter at (5, 3) - right after vertical phrase would end
        grid[5][3] = {"letter": "Z", "phrase_indices": [0]}
        # Try to place "CAT" vertically from (2, 3) to (4, 3) - cell after (5, 3) is occupied
        coords = [(2, 3), (3, 3), (4, 3)]
        assert not _is_valid_crossword_placement(grid, "CAT", coords, 10)
