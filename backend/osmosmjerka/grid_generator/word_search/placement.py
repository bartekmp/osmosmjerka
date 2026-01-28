"""Phrase placement strategies for grid generation."""

import random
from typing import Dict, List, Optional, Tuple

from osmosmjerka.grid_generator.shared.normalization import find_intersections, normalize_phrase
from osmosmjerka.grid_generator.word_search.scoring import score_phrase_placement
from osmosmjerka.grid_generator.shared.utils import _place_phrase_on_grid


def _is_valid_placement(grid: List[List[str]], phrase: str, coords: List[Tuple[int, int]], size: int) -> bool:
    """
    Check if a phrase can be placed at the given coordinates.
    Helper function for placement validation.
    """
    # Check bounds
    if not all(0 <= r < size and 0 <= c < size for r, c in coords):
        return False

    # Check conflicts (each position must be empty or match the phrase letter)
    return all(grid[r][c] in ("", phrase[i]) for i, (r, c) in enumerate(coords))


def try_place_phrase_with_intersections(
    grid: List[List[str]], phrase: str, placed_phrases: List[Dict]
) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Attempt to place a phrase by finding intersections with already placed phrases.
    This is the primary placement strategy that creates interconnected phrase networks.

    Args:
        grid: Current grid state
        phrase: Normalized phrase to place
        placed_phrases: List of already placed phrases with their coordinates

    Returns:
        Tuple of (coordinates, direction) if successful placement found, None otherwise
    """
    size = len(grid)
    best_placement = None
    best_score = -1

    # All possible directions for phrase placement
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    # Try to intersect with each already placed phrase
    for placed_phrase_info in placed_phrases:
        placed_phrase = normalize_phrase(placed_phrase_info["phrase"].replace(" ", "").upper())
        placed_coords = placed_phrase_info["coords"]

        # Find all possible intersection points between the two phrases
        intersections = find_intersections(phrase, placed_phrase)

        # Try each intersection point
        for phrase_pos, placed_pos in intersections:
            placed_r, placed_c = placed_coords[placed_pos]

            # Try placing the phrase in each direction from this intersection point
            for dr, dc in directions:
                # Calculate where the phrase would start
                start_r = placed_r - dr * phrase_pos
                start_c = placed_c - dc * phrase_pos

                # Generate all coordinates the phrase would occupy
                coords = [(start_r + dr * i, start_c + dc * i) for i in range(len(phrase))]

                # Check if this placement is valid
                if _is_valid_placement(grid, phrase, coords, size):
                    # Score this placement opportunity
                    score = score_phrase_placement(grid, phrase, coords, placed_phrases, (dr, dc))
                    if score > best_score:
                        best_score = score
                        best_placement = (coords, (dr, dc))

    return best_placement


def try_systematic_placement(
    grid: List[List[str]], phrase: str, size: int, directions: List[Tuple[int, int]]
) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Try systematic placement by checking all positions methodically.
    This is a fallback strategy when intersection-based placement fails.

    Args:
        grid: Current grid state
        phrase: Normalized phrase to place
        size: Grid size
        directions: List of direction vectors to try

    Returns:
        Tuple of (coordinates, direction) if successful placement found, None otherwise
    """
    phrase_len = len(phrase)

    # Try every position and direction systematically
    for row in range(size):
        for col in range(size):
            for dr, dc in directions:
                # Calculate end position
                end_r = row + dr * (phrase_len - 1)
                end_c = col + dc * (phrase_len - 1)

                # Check if phrase fits in bounds
                if 0 <= end_r < size and 0 <= end_c < size:
                    coords = [(row + dr * i, col + dc * i) for i in range(phrase_len)]

                    # Check if placement is valid (no conflicts)
                    if all(grid[r][c] in ("", phrase[i]) for i, (r, c) in enumerate(coords)):
                        return (coords, (dr, dc))

    return None


def _try_random_placement_with_scoring(
    grid: List[List[str]], phrase: str, placed_phrases: List[Dict]
) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Try random placement with intelligent scoring.
    This balances randomness with strategic placement decisions.
    """
    size = len(grid)
    phrase_len = len(phrase)
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    best_placement = None
    best_score = -1
    max_attempts = min(size * size * 2, 200)  # Reasonable attempt limit

    for attempt in range(max_attempts):
        # Try random position and direction
        row = random.randint(0, size - 1)  # noqa: S311
        col = random.randint(0, size - 1)  # noqa: S311

        random.shuffle(directions)  # Try directions in random order
        for dr, dc in directions:
            # Check if phrase fits in this direction
            end_r = row + dr * (phrase_len - 1)
            end_c = col + dc * (phrase_len - 1)

            if 0 <= end_r < size and 0 <= end_c < size:
                coords = [(row + dr * i, col + dc * i) for i in range(phrase_len)]

                # Check if placement is valid
                if all(grid[r][c] in ("", phrase[i]) for i, (r, c) in enumerate(coords)):
                    score = score_phrase_placement(grid, phrase, coords, placed_phrases, (dr, dc))
                    if score > best_score:
                        best_score = score
                        best_placement = (coords, (dr, dc))

        # Use progressively lower thresholds to ensure eventual placement
        threshold = max(1, 5 - (attempt // 20))
        if best_score >= threshold:
            break

    return best_placement


def place_single_phrase(grid: List[List[str]], phrase_data: Tuple[Dict, str, str], placed_phrases: List[Dict]) -> bool:
    """
    Attempt to place a single phrase in the grid using the best available strategy.

    Placement strategy priority:
    1. Intersection with existing phrases (creates connected network)
    2. Random placement with scoring (finds good spots)
    3. Systematic placement (fallback to ensure placement)

    Args:
        grid: Current grid state (modified in place)
        phrase_data: Tuple of (phrase_object, phrase_text, translation)
        placed_phrases: List of already placed phrases (modified in place)

    Returns:
        bool: True if phrase was successfully placed, False otherwise
    """
    phrase_obj, orig_phrase, translation = phrase_data
    phrase_normalized = normalize_phrase(orig_phrase.replace(" ", "").upper())
    size = len(grid)

    # Skip phrases that are too long for the grid
    if len(phrase_normalized) > size:
        return False

    # Strategy 1: Try intersection-based placement if we have existing phrases
    if placed_phrases:
        result = try_place_phrase_with_intersections(grid, phrase_normalized, placed_phrases)
        if result:
            coords, direction = result
            _place_phrase_on_grid(grid, phrase_normalized, coords)
            # Preserve all fields from original phrase object, adding coords
            placed_phrase = {**phrase_obj, "coords": coords}
            placed_phrases.append(placed_phrase)
            return True

    # Strategy 2: Try random placement with scoring
    result = _try_random_placement_with_scoring(grid, phrase_normalized, placed_phrases)
    if result:
        coords, direction = result
        _place_phrase_on_grid(grid, phrase_normalized, coords)
        # Preserve all fields from original phrase object, adding coords
        placed_phrase = {**phrase_obj, "coords": coords}
        placed_phrases.append(placed_phrase)
        return True

    # Strategy 3: Fallback to systematic placement
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    result = try_systematic_placement(grid, phrase_normalized, size, directions)
    if result:
        coords, direction = result
        _place_phrase_on_grid(grid, phrase_normalized, coords)
        # Preserve all fields from original phrase object, adding coords
        placed_phrase = {**phrase_obj, "coords": coords}
        placed_phrases.append(placed_phrase)
        return True

    return False
