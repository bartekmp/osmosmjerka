"""Crossword puzzle grid generator.

Generates crossword-style grids where phrases intersect horizontally and vertically.
Unlike word search grids, crossword grids only use horizontal (across) and vertical (down)
orientations, and phrases must intersect at common letters.
"""

from typing import Dict, List, Optional, Tuple

from osmosmjerka.grid_generator.normalization import find_intersections, normalize_phrase

# Crossword directions: horizontal (across) and vertical (down) only
CROSSWORD_DIRECTIONS = [(0, 1), (1, 0)]  # right, down


def generate_crossword_grid(phrases: list, size: int | None = None) -> tuple[list, list]:
    """
    Generate a crossword puzzle grid with the given phrases.

    Unlike word search which uses 8 directions, crossword uses only horizontal
    and vertical placements with required intersections.

    Args:
        phrases: List of dictionaries with "phrase" and "translation" keys
        size: Grid size. If None, calculated automatically

    Returns:
        tuple: (grid, placed_phrases) where:
            - grid: 2D list with cell metadata (empty cells are None)
            - placed_phrases: List of dicts with phrase info, coords, direction, and start_number
    """
    # Step 1: Filter phrases (minimum 3 characters)
    valid_phrases = [w for w in phrases if len(w["phrase"].strip()) >= 3]
    if not valid_phrases:
        return [], []

    # Step 2: Sort by length (longest first for better placement)
    phrase_pairs = [(w, w["phrase"], w["translation"]) for w in valid_phrases]
    phrase_pairs.sort(key=lambda x: len(normalize_phrase(x[1].replace(" ", "").upper())), reverse=True)

    # Step 3: Calculate grid size if not provided
    if size is None:
        longest = max(len(normalize_phrase(p[1].replace(" ", "").upper())) for p in phrase_pairs)
        size = max(longest + 4, 10)  # At least 4 cells padding and minimum 10

    # Step 4: Initialize grid with None (empty cells)
    grid = [[None for _ in range(size)] for _ in range(size)]
    placed_phrases = []
    start_number = 1

    # Step 5: Place each phrase
    for phrase_data in phrase_pairs:
        result = _place_crossword_phrase(grid, phrase_data, placed_phrases, size)
        if result:
            coords, direction = result
            phrase_obj, orig_phrase, translation = phrase_data
            normalized = normalize_phrase(orig_phrase.replace(" ", "").upper())

            # Place letters on grid
            for i, (r, c) in enumerate(coords):
                if grid[r][c] is None:
                    grid[r][c] = {"letter": normalized[i], "phrase_indices": []}
                grid[r][c]["phrase_indices"].append(len(placed_phrases))

            # Determine if this is a new starting position
            start_r, start_c = coords[0]
            is_new_start = True
            for existing in placed_phrases:
                if existing["coords"][0] == [start_r, start_c]:
                    is_new_start = False
                    break

            placed_phrase = {
                **phrase_obj,
                "coords": coords,
                "direction": "across" if direction == (0, 1) else "down",
                "start_number": start_number
                if is_new_start
                else _find_existing_start_number(placed_phrases, start_r, start_c),
            }

            if is_new_start:
                start_number += 1

            placed_phrases.append(placed_phrase)

    # Step 6: Validate minimum phrase count
    # Rule: At least size // 2 + 1 phrases must be placed
    min_phrases = (size // 2) + 1
    if len(placed_phrases) < min_phrases:
        # If we failed to place enough phrases, consider this an invalid puzzle
        # This prompts the retry logic (or error return) in the caller
        raise ValueError(
            f"Could not place enough phrases. Needed {min_phrases}, placed {len(placed_phrases)} for grid size {size}"
        )

    return grid, placed_phrases


def _find_existing_start_number(placed_phrases: List[Dict], row: int, col: int) -> int:
    """Find the start number for a phrase that shares a starting position."""
    for phrase in placed_phrases:
        if phrase["coords"][0] == [row, col]:
            return phrase["start_number"]
    return 0


def _place_crossword_phrase(
    grid: List[List], phrase_data: Tuple[Dict, str, str], placed_phrases: List[Dict], size: int
) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Place a phrase in the crossword grid.

    Returns (coords, direction) if successful, None otherwise.
    """
    phrase_obj, orig_phrase, translation = phrase_data
    normalized = normalize_phrase(orig_phrase.replace(" ", "").upper())
    phrase_len = len(normalized)

    # Skip if too long for grid
    if phrase_len > size:
        return None

    # If no phrases placed yet, place in center
    if not placed_phrases:
        return _place_first_phrase(grid, normalized, size)

    # Try to find an intersection with existing phrases
    best_placement = None
    best_score = -1

    for placed in placed_phrases:
        placed_normalized = normalize_phrase(placed["phrase"].replace(" ", "").upper())
        placed_coords = placed["coords"]
        placed_dir = (0, 1) if placed["direction"] == "across" else (1, 0)

        # Find intersection points
        intersections = find_intersections(normalized, placed_normalized)

        for phrase_pos, placed_pos in intersections:
            # Get the intersection cell
            int_r, int_c = placed_coords[placed_pos]

            # Try perpendicular direction
            for dr, dc in CROSSWORD_DIRECTIONS:
                if (dr, dc) == placed_dir:
                    continue  # Skip same direction

                # Calculate start position
                start_r = int_r - dr * phrase_pos
                start_c = int_c - dc * phrase_pos

                # Generate coords
                coords = [(start_r + dr * i, start_c + dc * i) for i in range(phrase_len)]

                # Validate placement
                if _is_valid_crossword_placement(grid, normalized, coords, size):
                    score = _score_crossword_placement(grid, coords, placed_phrases)
                    if score > best_score:
                        best_score = score
                        best_placement = (coords, (dr, dc))

    return best_placement


def _place_first_phrase(grid: List[List], phrase: str, size: int) -> Tuple[List[Tuple[int, int]], Tuple[int, int]]:
    """Place the first phrase in the center of the grid, horizontally."""
    phrase_len = len(phrase)
    start_col = (size - phrase_len) // 2
    start_row = size // 2

    coords = [(start_row, start_col + i) for i in range(phrase_len)]
    return (coords, (0, 1))  # Horizontal


def _is_valid_crossword_placement(grid: List[List], phrase: str, coords: List[Tuple[int, int]], size: int) -> bool:
    """
    Check if a crossword placement is valid.

    Rules:
    1. All coords must be within bounds
    2. Each cell must be empty OR contain the same letter
    3. No adjacent parallel words (would create invalid crossword)
    4. Buffer space before and after the phrase (no adjacent words in same direction)
    """
    for i, (r, c) in enumerate(coords):
        # Bounds check
        if not (0 <= r < size and 0 <= c < size):
            return False

        # Cell compatibility check
        cell = grid[r][c]
        if cell is not None and cell["letter"] != phrase[i]:
            return False

    # Determine phrase direction
    if len(coords) >= 2:
        dr = coords[1][0] - coords[0][0]
        dc = coords[1][1] - coords[0][1]

        # Rule 4: Check buffer before first cell and after last cell
        # This prevents phrases from running into each other along their direction
        first_r, first_c = coords[0]
        before_r, before_c = first_r - dr, first_c - dc
        if 0 <= before_r < size and 0 <= before_c < size:
            if grid[before_r][before_c] is not None:
                return False  # Cell before phrase start is occupied

        last_r, last_c = coords[-1]
        after_r, after_c = last_r + dr, last_c + dc
        if 0 <= after_r < size and 0 <= after_c < size:
            if grid[after_r][after_c] is not None:
                return False  # Cell after phrase end is occupied

        # Rule 3: Check perpendicular adjacent cells
        perp_dr, perp_dc = (-dc, dr) if dc != 0 else (0, 1 if dr == 0 else 0)
        if dr == 1:  # Vertical phrase
            perp_dr, perp_dc = 0, 1
        else:  # Horizontal phrase
            perp_dr, perp_dc = 1, 0

        for i, (r, c) in enumerate(coords):
            # Check cells perpendicular to this position
            for delta in [-1, 1]:
                adj_r = r + perp_dr * delta
                adj_c = c + perp_dc * delta

                if 0 <= adj_r < size and 0 <= adj_c < size:
                    adj_cell = grid[adj_r][adj_c]
                    if adj_cell is not None:
                        # This adjacent cell has a letter - check if it's from an intersecting word
                        # If we're not intersecting here (our cell is empty), this is invalid
                        if grid[r][c] is None:
                            return False

    return True


def _score_crossword_placement(grid: List[List], coords: List[Tuple[int, int]], placed_phrases: List[Dict]) -> int:
    """Score a crossword placement - prefer more intersections."""
    score = 0

    for r, c in coords:
        if grid[r][c] is not None:
            score += 10  # Bonus for intersection

    # Penalty for being too far from center
    size = len(grid)
    center = size // 2
    avg_r = sum(c[0] for c in coords) / len(coords)
    avg_c = sum(c[1] for c in coords) / len(coords)
    distance_from_center = abs(avg_r - center) + abs(avg_c - center)
    score -= int(distance_from_center)

    return score
