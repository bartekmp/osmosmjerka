import random


def generate_grid(words, size=None):
    """Generate a word search grid with the given words and size.
    Args:
        words (list): A list of dictionaries with "word" and "translation" keys.
        size (int, optional): The size of the grid. If None, it will be
            determined by the longest word in the list.
    Returns:
        tuple: A tuple containing the grid (list of lists) and a list of placed words
            with their translations and coordinates.
    """
    if not words:
        return [], []
    word_pairs = [(w["word"], w["translation"]) for w in words]
    # Remove whitespace and convert to uppercase
    words_nospaces = [w[0].replace(" ", "").upper() for w in word_pairs]
    # Decide the grid size based on the difficulty level specified by the user, if not provided
    # use the longest word length as the default size
    if size is None:
        size = max(len(w) for w in words_nospaces)
    grid = [["" for _ in range(size)] for _ in range(size)]
    # Directions for placing words: (row_change, col_change)
    # 8 possible directions: horizontal, vertical, and diagonal
    # (up, down, left, right, and the four diagonals)
    # Directions are represented as (row_change, col_change)
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    placed = []
    # Try to place each word in the grid
    for (orig_word, trans) in word_pairs:
        word_nospaces = orig_word.replace(" ", "").upper()
        random.shuffle(directions)
        # Try 100 times to find a valid position for the word
        # If it fails, skip to the next word
        for _ in range(100):
            # Randomly choose a starting position and direction
            # Ensure the word fits within the grid boundaries
            size = len(grid)
            if size == 0:
                continue
            if len(word_nospaces) > size:
                break
            # Randomly select a starting position and direction
            row = random.randint(0, size - 1)
            col = random.randint(0, size - 1)
            dr, dc = random.choice(directions)
            end_r = row + dr * (len(word_nospaces) - 1)
            end_c = col + dc * (len(word_nospaces) - 1)
            # Check if the end position is within the grid boundaries
            # and if the word can be placed without conflicts
            if 0 <= end_r < size and 0 <= end_c < size:
                # Check if the word can be placed in the grid
                # without overlapping with existing letters
                # and without conflicts with existing letters
                # in the grid
                coords = [(row + dr * i, col + dc * i) for i in range(len(word_nospaces))]
                # Check if all coordinates are within bounds
                if all(grid[r][c] in ("", word_nospaces[i]) for i, (r, c) in enumerate(coords)):
                    for i, (r, c) in enumerate(coords):
                        grid[r][c] = word_nospaces[i]
                    # Store the word and its translation along with coordinates
                    placed.append(
                        {
                            "word": orig_word,
                            "translation": trans,
                            "coords": coords
                        }
                    )
                    break
    for r in range(size):
        for c in range(size):
            # Fill empty cells with random letters
            if grid[r][c] == "":
                grid[r][c] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return grid, placed
