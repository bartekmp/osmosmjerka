"""Helper functions for game API endpoints."""

import random

from osmosmjerka.grid_generator.crossword import generate_crossword_grid
from osmosmjerka.grid_generator.word_search import generate_grid


def get_grid_size_and_num_phrases(selected: list, difficulty: str) -> tuple:
    """Get grid size and number of phrases based on difficulty and available phrases."""
    if difficulty == "very_easy":
        grid_size = 8
        num_phrases = 5
    elif difficulty == "easy":
        grid_size = 10
        num_phrases = 7
    elif difficulty == "medium":
        grid_size = 13
        num_phrases = 10
    elif difficulty == "hard":
        grid_size = 15
        num_phrases = 12
    elif difficulty == "very_hard":
        grid_size = 20
        num_phrases = 16
    else:
        grid_size = 10
        num_phrases = 7

    return grid_size, num_phrases


def _generate_grid_with_exact_phrase_count(
    all_phrases: list, grid_size: int, target_phrase_count: int, game_type: str = "word_search"
) -> tuple:
    """
    Generate a grid with exactly the target number of phrases.
    If not all phrases can be placed, try different combinations until we get the target count.

    Args:
        all_phrases: List of phrase dictionaries
        grid_size: Size of the grid
        target_phrase_count: Target number of phrases to place
        game_type: "word_search" or "crossword"
    """
    # Use crossword generator for crossword game type
    if game_type == "crossword":
        min_needed = (grid_size // 2) + 1
        if len(all_phrases) < min_needed:
            raise ValueError(
                f"Not enough phrases for crossword. Needed {min_needed}, "
                f"available {len(all_phrases)} for grid size {grid_size}"
            )
        return generate_formatted_crossword_grid(all_phrases, grid_size, target_phrase_count)

    max_attempts = 50  # Limit attempts to avoid infinite loops
    attempt = 0
    best_grid = None
    best_placed_phrases = []

    # First, try with a random selection as before
    if len(all_phrases) > target_phrase_count:
        selected_phrases = random.sample(all_phrases, target_phrase_count)
    else:
        selected_phrases = all_phrases.copy()
        random.shuffle(selected_phrases)

    while attempt < max_attempts:
        grid, placed_phrases = generate_grid(selected_phrases, grid_size)

        # Keep track of the best result so far
        if len(placed_phrases) > len(best_placed_phrases):
            best_grid = grid
            best_placed_phrases = placed_phrases

        # If we got exactly the target number, we're done
        if len(placed_phrases) == target_phrase_count:
            return grid, placed_phrases

        # If we got fewer phrases than target, try with different phrases
        if len(placed_phrases) < target_phrase_count:
            # Calculate how many more phrases we need
            phrases_needed = target_phrase_count - len(placed_phrases)

            # Get phrases that weren't placed
            placed_phrase_texts = {p["phrase"] for p in placed_phrases}
            unplaced_phrases = [p for p in all_phrases if p["phrase"] not in placed_phrase_texts]

            # If we have enough unplaced phrases, try replacing some phrases
            if len(unplaced_phrases) >= phrases_needed and len(all_phrases) > target_phrase_count:
                # Remove some phrases that were placed and add some that weren't
                phrases_to_remove = min(3, len(placed_phrases))  # Remove a few placed phrases
                phrases_to_add = min(phrases_needed + phrases_to_remove, len(unplaced_phrases))

                # Create new selection by keeping most placed phrases and adding unplaced ones
                kept_phrases = random.sample(
                    [p for p in selected_phrases if p["phrase"] in placed_phrase_texts],
                    max(0, target_phrase_count - phrases_to_add),
                )
                new_phrases = random.sample(unplaced_phrases, phrases_to_add)
                selected_phrases = kept_phrases + new_phrases
            else:
                # Try with all available phrases if we don't have many options
                selected_phrases = all_phrases.copy()
                random.shuffle(selected_phrases)

        # If we got more phrases than target (shouldn't happen with current logic, but just in case)
        elif len(placed_phrases) > target_phrase_count:
            # Just trim the result to target count
            return grid, placed_phrases[:target_phrase_count]

        attempt += 1

    # If we couldn't get the exact target, return the best result we achieved
    # but ensure we don't return more than the target
    if len(best_placed_phrases) > target_phrase_count:
        best_placed_phrases = best_placed_phrases[:target_phrase_count]

    return best_grid if best_grid is not None else [], best_placed_phrases


def generate_formatted_crossword_grid(
    all_phrases: list, grid_size: int, target_phrase_count: int, max_retries: int = 5
) -> tuple:
    """
    Generate a crossword-style grid with the target number of phrases.

    Uses an expanded phrase pool (3x target) and retry logic to improve
    success rate when some phrases can't be placed due to lack of intersections.

    Args:
        all_phrases: List of phrase dictionaries with 'phrase' and 'translation' keys
        grid_size: Size of the grid
        target_phrase_count: Target number of phrases to place
        max_retries: Number of generation attempts before giving up

    Returns:
        tuple: (grid, placed_phrases) where grid is a 2D array and placed_phrases
               contains phrase metadata including coords and direction
    """
    min_phrases = (grid_size // 2) + 1
    best_grid = None
    best_placed_phrases = []

    for attempt in range(max_retries):
        # Select an expanded pool of phrases (3x target, but at least all available)
        pool_size = min(len(all_phrases), target_phrase_count * 3)
        if pool_size <= target_phrase_count:
            # Not enough phrases - use all of them
            selected_phrases = all_phrases.copy()
        else:
            # Random sample from pool for variety on each retry
            selected_phrases = random.sample(all_phrases, pool_size)

        # Shuffle for different ordering on each attempt
        random.shuffle(selected_phrases)

        try:
            # Generate crossword grid - pass the expanded pool
            grid, placed_phrases = generate_crossword_grid(selected_phrases, grid_size)

            # Track best result so far
            if len(placed_phrases) > len(best_placed_phrases):
                best_grid = grid
                best_placed_phrases = placed_phrases

            # Success! We placed enough phrases
            if len(placed_phrases) >= min_phrases:
                # Trim to target count if we placed more
                if len(placed_phrases) > target_phrase_count:
                    placed_phrases = placed_phrases[:target_phrase_count]

                # Convert grid to simple character array
                simple_grid = _convert_crossword_grid_to_simple(grid)

                # Convert coords to frontend format
                for phrase in placed_phrases:
                    if phrase.get("coords"):
                        phrase["coords"] = [[r, c] for r, c in phrase["coords"]]

                return simple_grid, placed_phrases

        except ValueError:
            # Continue to next attempt
            pass
    # All retries exhausted - return best result if it meets minimum, else error
    if len(best_placed_phrases) >= min_phrases:
        if len(best_placed_phrases) > target_phrase_count:
            best_placed_phrases = best_placed_phrases[:target_phrase_count]

        simple_grid = _convert_crossword_grid_to_simple(best_grid) if best_grid else []

        for phrase in best_placed_phrases:
            if phrase.get("coords"):
                phrase["coords"] = [[r, c] for r, c in phrase["coords"]]

        return simple_grid, best_placed_phrases

    # Truly failed - raise the last error or a summary
    raise ValueError(
        f"Could not generate crossword after {max_retries} attempts. "
        f"Best result: {len(best_placed_phrases)} phrases, needed {min_phrases} for grid size {grid_size}"
    )


def _convert_crossword_grid_to_simple(grid: list) -> list:
    """Convert crossword grid format to simple character array for frontend."""
    simple_grid = []
    for row in grid:
        simple_row = []
        for cell in row:
            if cell is None:
                simple_row.append(None)  # Blank cell - frontend expects null
            else:
                simple_row.append(cell.get("letter", ""))
        simple_grid.append(simple_row)
    return simple_grid
