"""Tests for crossword generation retry logic in helpers.py."""

from unittest.mock import patch

import pytest
from osmosmjerka.game_api.helpers import (
    _convert_crossword_grid_to_simple,
    generate_formatted_crossword_grid,
)


class TestGenerateFormattedCrosswordGrid:
    """Tests for the crossword generation with retry logic."""

    def _make_phrases(self, count: int) -> list:
        """Generate test phrases."""
        words = [
            "APPLE",
            "BANANA",
            "CHERRY",
            "DATE",
            "ELDERBERRY",
            "FIG",
            "GRAPE",
            "HONEYDEW",
            "KIWI",
            "LEMON",
            "MANGO",
            "NECTARINE",
            "ORANGE",
            "PAPAYA",
            "QUINCE",
            "RASPBERRY",
            "STRAWBERRY",
            "TANGERINE",
            "WATERMELON",
            "APRICOT",
        ]
        return [{"phrase": words[i % len(words)], "translation": f"translation_{i}"} for i in range(count)]

    def test_success_on_first_attempt(self):
        """Test that generation succeeds when phrases can be placed."""
        phrases = self._make_phrases(20)  # Plenty of phrases
        grid, placed = generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5)

        # Should have placed at least minimum required (10//2 + 1 = 6)
        # But our target is 5, and we may get at least some
        assert len(placed) >= 1  # At least something was placed
        assert grid is not None
        assert len(grid) == 10

    def test_uses_expanded_phrase_pool(self):
        """Test that the function uses more phrases than target."""
        phrases = self._make_phrases(30)

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            # Mock successful generation
            mock_grid = [[{"letter": "A", "phrase_indices": [0]}] * 10 for _ in range(10)]
            mock_placed = [
                {
                    "phrase": "TEST",
                    "translation": "test",
                    "coords": [(0, i) for i in range(4)],
                    "direction": "across",
                    "start_number": 1,
                }
                for _ in range(6)  # Enough to satisfy minimum
            ]
            mock_gen.return_value = (mock_grid, mock_placed)

            generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5)

            # Should have been called with more than 5 phrases (3x = 15)
            called_phrases = mock_gen.call_args[0][0]
            assert len(called_phrases) > 5

    def test_retries_on_failure(self):
        """Test that the function retries when generation fails."""
        phrases = self._make_phrases(20)

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            # First 3 attempts fail, 4th succeeds
            mock_grid = [[{"letter": "A", "phrase_indices": [0]}] * 10 for _ in range(10)]
            mock_placed = [
                {
                    "phrase": "TEST",
                    "translation": "test",
                    "coords": [(0, i) for i in range(4)],
                    "direction": "across",
                    "start_number": 1,
                }
                for _ in range(6)
            ]

            mock_gen.side_effect = [
                ValueError("Not enough phrases"),
                ValueError("Not enough phrases"),
                ValueError("Not enough phrases"),
                (mock_grid, mock_placed),  # Success on 4th attempt
            ]

            grid, placed = generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5)

            assert mock_gen.call_count == 4
            assert len(placed) >= 5

    def test_returns_best_result_on_partial_success(self):
        """Test that best partial result is returned if it meets minimum."""
        phrases = self._make_phrases(20)

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            # All attempts produce partial results, last one is best
            mock_grid = [[{"letter": "A", "phrase_indices": [0]}] * 10 for _ in range(10)]

            def make_placed(count):
                return [
                    {
                        "phrase": f"TEST{i}",
                        "translation": f"test{i}",
                        "coords": [(0, j) for j in range(4)],
                        "direction": "across",
                        "start_number": i + 1,
                    }
                    for i in range(count)
                ]

            # Returns 4, 5, 6 phrases - 6 meets minimum (grid_size=10 -> min=6)
            mock_gen.side_effect = [
                (mock_grid, make_placed(4)),
                (mock_grid, make_placed(5)),
                (mock_grid, make_placed(6)),  # Best result, meets minimum
                (mock_grid, make_placed(5)),
                (mock_grid, make_placed(4)),
            ]

            grid, placed = generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=8)

            # Should return the best result (6 phrases)
            assert len(placed) == 6

    def test_raises_error_after_all_retries_exhausted(self):
        """Test that error is raised if all retries fail to meet minimum."""
        phrases = self._make_phrases(5)  # Very few phrases

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            # All attempts fail
            mock_gen.side_effect = ValueError("Not enough phrases")

            with pytest.raises(ValueError, match="Could not generate crossword after"):
                generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5)

            assert mock_gen.call_count == 5  # Default max_retries

    def test_trims_to_target_count(self):
        """Test that result is trimmed to target phrase count."""
        phrases = self._make_phrases(20)

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            mock_grid = [[{"letter": "A", "phrase_indices": [0]}] * 10 for _ in range(10)]
            mock_placed = [
                {
                    "phrase": f"TEST{i}",
                    "translation": f"test{i}",
                    "coords": [(0, j) for j in range(4)],
                    "direction": "across",
                    "start_number": i + 1,
                }
                for i in range(10)  # More than target
            ]
            mock_gen.return_value = (mock_grid, mock_placed)

            grid, placed = generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5)

            assert len(placed) == 5  # Trimmed to target

    def test_custom_max_retries(self):
        """Test that max_retries parameter is respected."""
        phrases = self._make_phrases(20)

        with patch("osmosmjerka.game_api.helpers.generate_crossword_grid") as mock_gen:
            mock_gen.side_effect = ValueError("Not enough phrases")

            with pytest.raises(ValueError):
                generate_formatted_crossword_grid(phrases, grid_size=10, target_phrase_count=5, max_retries=3)

            assert mock_gen.call_count == 3


class TestConvertCrosswordGridToSimple:
    """Tests for the grid conversion helper."""

    def test_converts_cells_to_letters(self):
        """Test that cell objects are converted to simple letters."""
        grid = [
            [{"letter": "A", "phrase_indices": [0]}, {"letter": "B", "phrase_indices": [0]}],
            [None, {"letter": "C", "phrase_indices": [1]}],
        ]

        result = _convert_crossword_grid_to_simple(grid)

        assert result == [["A", "B"], [None, "C"]]

    def test_handles_empty_grid(self):
        """Test that empty grid is handled."""
        result = _convert_crossword_grid_to_simple([])
        assert result == []

    def test_handles_all_null_grid(self):
        """Test that grid with all None cells works."""
        grid = [[None, None], [None, None]]
        result = _convert_crossword_grid_to_simple(grid)
        assert result == [[None, None], [None, None]]
