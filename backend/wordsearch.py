import random


def generate_grid(word_pairs):
    if not word_pairs:
        return [], []
    words = [w[0].upper() for w in word_pairs]
    size = max(len(w) for w in words)
    grid = [["" for _ in range(size)] for _ in range(size)]
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    placed = []

    for word, trans in word_pairs:
        word = word.upper()
        random.shuffle(directions)
        for _ in range(100):
            row = random.randint(0, size - 1)
            col = random.randint(0, size - 1)
            dr, dc = random.choice(directions)
            end_r = row + dr * (len(word) - 1)
            end_c = col + dc * (len(word) - 1)
            if 0 <= end_r < size and 0 <= end_c < size:
                coords = [(row + dr * i, col + dc * i) for i in range(len(word))]
                if all(grid[r][c] in ("", word[i]) for i, (r, c) in enumerate(coords)):
                    for i, (r, c) in enumerate(coords):
                        grid[r][c] = word[i]
                    placed.append(
                        {"word": word, "translation": trans, "coords": coords}
                    )
                    break
    for r in range(size):
        for c in range(size):
            if grid[r][c] == "":
                grid[r][c] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return grid, placed
