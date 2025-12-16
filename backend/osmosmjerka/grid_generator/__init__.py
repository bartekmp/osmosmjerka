"""Grid generation module for creating phrase search puzzles."""

from osmosmjerka.grid_generator.normalization import find_intersections, normalize_phrase
from osmosmjerka.grid_generator.placement import place_single_phrase
from osmosmjerka.grid_generator.utils import (
    _fill_empty_cells_with_random_letters,
    calculate_density_around_position,
    calculate_optimal_grid_size,
)


def generate_grid(phrases: list, size: int | None = None) -> tuple[list, list]:
    """
    Generate a phrase search grid with the given phrases and size.

    This is the main entry point for grid generation. The algorithm uses an intelligent
    placement strategy that prioritizes phrase intersections to create dense, interconnected
    phrase networks while maintaining good visual diversity.

    Algorithm Overview:
    1. Filter and prepare phrases (minimum 3 characters)
    2. Sort phrases by length (longest first for better foundation)
    3. Calculate optimal grid size if not provided
    4. Place each phrase using multi-strategy approach:
       - Intersection-based placement (preferred)
       - Random placement with scoring
       - Systematic placement (fallback)
    5. Fill remaining cells with random letters

    Args:
        phrases (list): List of dictionaries with "phrase" and "translation" keys
        size (int | None): Grid size. If None, calculated automatically for optimal density

    Returns:
        tuple: (grid, placed_phrases) where:
            - grid: 2D list of characters representing the phrase search grid
            - placed_phrases: List of dictionaries with phrase info and coordinates
    """
    # Step 1: Filter phrases (minimum 3 characters) and handle edge cases
    valid_phrases = [w for w in phrases if len(w["phrase"].strip()) >= 3]
    if not valid_phrases:
        return [], []

    # Step 2: Prepare and sort phrases (longest first for better placement foundation)
    # Keep full phrase objects to preserve all fields (id, categories, etc.)
    phrase_pairs = [(w, w["phrase"], w["translation"]) for w in valid_phrases]
    phrase_pairs.sort(key=lambda x: len(normalize_phrase(x[1].replace(" ", "").upper())), reverse=True)

    # Step 3: Calculate optimal grid size
    # Extract just phrase/translation tuples for size calculation
    phrase_text_pairs = [(p[1], p[2]) for p in phrase_pairs]
    grid_size = size if size is not None else calculate_optimal_grid_size(phrase_text_pairs)

    # Step 4: Initialize empty grid and placement tracking
    grid = [["" for _ in range(grid_size)] for _ in range(grid_size)]
    placed_phrases = []

    # Step 5: Place each phrase using intelligent multi-strategy approach
    for phrase_data in phrase_pairs:
        place_single_phrase(grid, phrase_data, placed_phrases)

    # Step 6: Fill empty cells with random letters to complete the puzzle
    _fill_empty_cells_with_random_letters(grid)

    return grid, placed_phrases


# Export main function and commonly used utilities for backward compatibility
__all__ = [
    "generate_grid",
    "normalize_phrase",
    "find_intersections",
    "calculate_density_around_position",
]
