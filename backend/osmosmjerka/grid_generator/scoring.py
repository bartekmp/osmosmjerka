"""Placement scoring logic for grid generation."""

from typing import Dict, List, Tuple

from osmosmjerka.grid_generator.utils import calculate_density_around_position


def _count_direction_usage(placed_phrases: List[Dict]) -> Dict[Tuple[int, int], int]:
    """
    Count how many times each direction has been used.
    Helper function for score_phrase_placement.
    """
    direction_counts = {}
    for placed in placed_phrases:
        coords = placed["coords"]
        if len(coords) >= 2:
            # Calculate direction vector
            dr = coords[1][0] - coords[0][0]
            dc = coords[1][1] - coords[0][1]
            # Normalize direction to unit vector
            if dr != 0:
                dr = dr // abs(dr)
            if dc != 0:
                dc = dc // abs(dc)
            direction = (dr, dc)
            direction_counts[direction] = direction_counts.get(direction, 0) + 1
    return direction_counts


def score_phrase_placement(
    grid: List[List[str]],
    phrase: str,
    coords: List[Tuple[int, int]],
    placed_phrases: List[Dict],
    direction: Tuple[int, int],
) -> float:
    """
    Score a potential phrase placement to determine if it's a good fit.
    Higher scores indicate better placements.

    Scoring factors:
    - Intersections with existing phrases (heavily favored)
    - Density of surrounding area (slightly penalized if too crowded)
    - Direction diversity (bonus for less-used directions)
    - Basic placement bonus (encourages placing more phrases)

    Args:
        grid: Current grid state
        phrase: Phrase being placed
        coords: Proposed coordinates for the phrase
        placed_phrase: List of already placed phrases
        direction: Direction vector (dr, dc) for the placement

    Returns:
        float: Placement score (higher is better)
    """
    score = 0

    # Count intersections with existing phrases
    intersections = sum(1 for i, (r, c) in enumerate(coords) if grid[r][c] != "" and grid[r][c] == phrase[i])

    # Strong bonus for intersections (encourages crossing phrases)
    score += intersections * 15

    # Small penalty for placing in crowded areas (allows density but prevents extreme clustering)
    density = calculate_density_around_position(grid, coords)
    score -= density * 2

    # Calculate direction diversity bonus
    direction_usage = _count_direction_usage(placed_phrases)
    current_dir_count = direction_usage.get(direction, 0)
    score += max(0, 2 - current_dir_count)  # Bonus for less-used directions

    # Small bonus for any valid placement (encourages placing more phrases)
    score += 1

    return score
