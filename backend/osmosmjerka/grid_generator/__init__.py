"""Grid generation module for creating puzzle grids.

This package provides generators for different puzzle types:
- word_search: Word search puzzle generation
- crossword: Crossword puzzle generation
- shared: Common utilities used by all generators

Usage:
    from osmosmjerka.grid_generator.word_search import generate_grid
    from osmosmjerka.grid_generator.crossword import generate_crossword_grid
"""

# Only re-export shared utilities at the top level
from osmosmjerka.grid_generator.shared import (
    calculate_density_around_position,
    calculate_optimal_grid_size,
    find_intersections,
    normalize_phrase,
)

__all__ = [
    "normalize_phrase",
    "find_intersections",
    "calculate_density_around_position",
    "calculate_optimal_grid_size",
]
