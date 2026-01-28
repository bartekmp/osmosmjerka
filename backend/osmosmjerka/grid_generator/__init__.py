"""Grid generation module for creating phrase search puzzles."""

from osmosmjerka.grid_generator.crossword.generator import generate_crossword_grid
from osmosmjerka.grid_generator.shared.normalization import find_intersections, normalize_phrase
from osmosmjerka.grid_generator.shared.utils import (
    calculate_density_around_position,
    calculate_optimal_grid_size,
)
from osmosmjerka.grid_generator.word_search.generator import generate_grid

__all__ = [
    "generate_grid",
    "generate_crossword_grid",
    "normalize_phrase",
    "find_intersections",
    "calculate_density_around_position",
    "calculate_optimal_grid_size",
]
