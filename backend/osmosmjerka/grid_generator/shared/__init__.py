"""Shared utilities for grid generation."""

from osmosmjerka.grid_generator.shared.normalization import find_intersections, normalize_phrase
from osmosmjerka.grid_generator.shared.utils import (
    calculate_density_around_position,
    calculate_optimal_grid_size,
)

__all__ = [
    "normalize_phrase",
    "find_intersections",
    "calculate_density_around_position",
    "calculate_optimal_grid_size",
]
