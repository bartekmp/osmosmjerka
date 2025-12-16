"""Grid utility functions for grid generation."""

import random
from typing import List, Tuple


def calculate_density_around_position(grid: List[List[str]], coords: List[Tuple[int, int]], radius: int = 2) -> float:
    """
    Calculate the density of placed letters around the given coordinates.
    This helps avoid placing phrases in already crowded areas.

    Args:
        grid: The current grid state
        coords: List of coordinates to check around
        radius: How many cells around each coordinate to check

    Returns:
        float: Density ratio (0.0 = empty, 1.0 = completely filled)
    """
    size = len(grid)
    total_cells = 0
    filled_cells = 0

    # Check area around each coordinate
    for r, c in coords:
        for dr in range(-radius, radius + 1):
            for dc in range(-radius, radius + 1):
                nr, nc = r + dr, c + dc
                if 0 <= nr < size and 0 <= nc < size:
                    total_cells += 1
                    if grid[nr][nc] != "":
                        filled_cells += 1

    return filled_cells / total_cells if total_cells > 0 else 0


def calculate_optimal_grid_size(phrase_pairs: List[Tuple[str, str]]) -> int:
    """
    Calculate the optimal grid size based on phrase characteristics.
    Balances between fitting all phrases and maintaining reasonable density.

    Args:
        phrase_pairs: List of (phrase, translation) tuples

    Returns:
        int: Optimal grid size (creates square grid)
    """
    from osmosmjerka.grid_generator.normalization import normalize_phrase

    normalized_phrases = [normalize_phrase(phrase.replace(" ", "").upper()) for phrase, _ in phrase_pairs]
    max_phrase_len = max(len(w) for w in normalized_phrases)
    avg_phrase_len = sum(len(w) for w in normalized_phrases) / len(normalized_phrases)
    phrase_count = len(normalized_phrases)

    # Base size ensures longest phrase fits
    base_size = max_phrase_len + 1

    # Scale based on phrase count and average length for better density
    if phrase_count <= 5:
        size = max(base_size, int(avg_phrase_len * 1.5))
    elif phrase_count <= 10:
        size = max(base_size, int(avg_phrase_len * 1.8))
    else:
        size = max(base_size, int(avg_phrase_len * 2.0))

    # Cap maximum size to prevent excessively large grids
    return min(size, max_phrase_len + 5)


def _place_phrase_on_grid(grid: List[List[str]], phrase: str, coords: List[Tuple[int, int]]) -> None:
    """
    Place a phrase on the grid at the specified coordinates.
    Helper function that modifies the grid in place.
    """
    for i, (r, c) in enumerate(coords):
        grid[r][c] = phrase[i]


def _fill_empty_cells_with_random_letters(grid: List[List[str]]) -> None:
    """
    Fill all empty cells in the grid with random letters.
    This makes the phrase search puzzle complete and challenging.
    """
    size = len(grid)
    for r in range(size):
        for c in range(size):
            if grid[r][c] == "":
                grid[r][c] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
