import random


def generate_grid(words: list, size: int | None = None) -> tuple[list, list]:
    """
    Generate a word search grid with the given words and size.
    Args:
        words (list): A list of dictionaries with "word" and "translation" keys.
        size (int | None): The size of the grid. If None, it will be determined based on the longest word.
    Returns:
        tuple: A tuple containing the grid (list of lists) and a list of placed words with their coordinates.
    """
    # Ensure all words are at least 3 characters long
    words = [w for w in words if len(w["word"].strip()) >= 3]

    # Normalize words: remove spaces and convert to uppercase
    # Create a list of word pairs (word, translation) for easier handling
    word_pairs = [(w["word"], w["translation"]) for w in words]
    words_nospaces = [w[0].replace(" ", "").upper() for w in word_pairs]

    # If there are no valid words left, return empty results
    if not words_nospaces:
        return [], []

    # If size is not provided, determine it based on the longest word
    if size is None:
        size = max(len(w) for w in words_nospaces)

    # Generate an empty square grid of the specified size
    grid = [["" for _ in range(size)] for _ in range(size)]

    # Directions for word placement: (row_offset, col_offset)
    # 8 possible directions: horizontal, vertical, and diagonal
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    # List to keep track of placed words with their coordinates
    placed_words = []

    # Shuffle the order of words to be placed to ensure randomness
    word_pairs = random.sample(word_pairs, len(word_pairs))

    for orig_word, trans in word_pairs:
        word_nospaces = orig_word.replace(" ", "").upper()
        word_len = len(word_nospaces)
        # Skip words that are longer than the grid size
        if word_len > size:
            continue

        # Generate all possible starting positions
        all_positions = [(row, col) for row in range(size) for col in range(size)]
        random.shuffle(all_positions)

        # Try to place the word in a random position and direction
        placed_word = False
        for row, col in all_positions:
            # Check if the word can fit in any direction
            dirs = directions[:]
            random.shuffle(dirs)
            for dr, dc in dirs:
                end_r = row + dr * (word_len - 1)
                end_c = col + dc * (word_len - 1)
                # Check if the word can be placed in this direction
                if 0 <= end_r < size and 0 <= end_c < size:
                    # Generate the coordinates for the word
                    coords = [(row + dr * i, col + dc * i) for i in range(word_len)]
                    # Check if the word can be placed (no conflicts)
                    if all(
                        grid[r][c] in ("", word_nospaces[i])
                        for i, (r, c) in enumerate(coords)
                    ):
                        # Place the word in the grid
                        for i, (r, c) in enumerate(coords):
                            grid[r][c] = word_nospaces[i]
                        # Add the word and its translation to the placed words list
                        placed_words.append(
                            {"word": orig_word, "translation": trans, "coords": coords}
                        )
                        placed_word = True
                        break
            # If the word was placed, break out of the loop
            if placed_word:
                break

    # Fill empty cells with random letters
    for r in range(size):
        for c in range(size):
            if grid[r][c] == "":
                grid[r][c] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    # Return the grid and the list of placed words
    return grid, placed_words
