"""Phrase normalization utilities for grid generation."""

from typing import List, Tuple


def normalize_phrase(phrase: str) -> str:
    """
    Normalize a phrase by removing spaces, punctuation, and converting to uppercase.
    Only alphabetic characters (any language) and hyphens are kept, but the result cannot begin or end with a hyphen.

    Args:
        phrase (str): The phrase to normalize.
    Returns:
        str: The normalized phrase.
    """
    # Keep only alphabetic (any language) and hyphens
    result = "".join(c.upper() for c in phrase if c.isalpha() or c == "-")
    # Remove leading/trailing hyphens
    return result.strip("-")


def find_intersections(phrase1: str, phrase2: str) -> List[Tuple[int, int]]:
    """
    Find all possible intersection points between two phrases.

    Args:
        phrase1 (str): First phrase to check for intersections
        phrase2 (str): Second phrase to check for intersections

    Returns:
        List[Tuple[int, int]]: List of (pos1, pos2) tuples where phrase1[pos1] == phrase2[pos2]
    """
    intersections = []
    for i, char1 in enumerate(phrase1):
        for j, char2 in enumerate(phrase2):
            if char1 == char2:
                intersections.append((i, j))
    return intersections
