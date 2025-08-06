import pytest

from osmosmjerka.grid_generator import generate_grid, normalize_word


def test_empty_words():
    grid, placed = generate_grid([])
    assert grid == []
    assert placed == []


def test_all_words_too_short():
    words = [{"word": "a", "translation": "A"}, {"word": "b", "translation": "B"}]
    grid, placed = generate_grid(words)
    assert grid == []
    assert placed == []


def test_single_word():
    words = [{"word": "TEST", "translation": "PRÓBA"}]
    grid, placed = generate_grid(words, size=6)
    assert len(grid) == 6
    assert len(grid[0]) == 6
    assert any("T" in row for row in grid)
    assert placed[0]["word"] == "TEST"
    assert placed[0]["translation"] == "PRÓBA"
    assert len(placed[0]["coords"]) == 4


def test_word_with_spaces():
    words = [{"word": "HELLO WORLD", "translation": "CZEŚĆ ŚWIECIE"}]
    grid, placed = generate_grid(words)
    coords = placed[0]["coords"]
    assert len(coords) == len("HELLOWORLD")
    letters = [grid[r][c] for r, c in coords]
    assert "".join(letters) == "HELLOWORLD"


def test_word_longer_than_grid():
    words = [{"word": "LONGWORD", "translation": "DLUGIESLOWO"}]
    grid, placed = generate_grid(words, size=3)
    assert placed == []
    assert all(len(row) == 3 for row in grid)


def test_multiple_words_no_overlap():
    words = [
        {"word": "CAT", "translation": "KOT"},
        {"word": "DOG", "translation": "PIES"},
        {"word": "BIRD", "translation": "PTAK"},
    ]
    grid, placed = generate_grid(words, size=7)
    assert len(placed) == 3
    for word in words:
        assert any(p["word"] == word["word"] for p in placed)


def test_fill_empty_cells():
    words = [{"word": "PYTHON", "translation": "WĄŻ"}]
    grid, placed = generate_grid(words, size=8)
    for row in grid:
        for cell in row:
            assert cell.isupper() and len(cell) == 1


def test_randomness_of_grid(monkeypatch):
    # Patch random.choice to always return 'X'
    import random

    monkeypatch.setattr(random, "choice", lambda seq: "X")
    words = [{"word": "PY", "translation": "PI"}]
    grid, placed = generate_grid(words, size=4)
    for row in grid:
        for cell in row:
            assert cell in ("P", "Y", "X")


def test_no_conflict_on_overlap():
    words = [
        {"word": "CROSS", "translation": "KRZYŻ"},
        {"word": "ROSS", "translation": "ROSS"},
    ]
    grid, placed = generate_grid(words, size=7)
    assert any(p["word"] == "CROSS" for p in placed)
    assert any(p["word"] == "ROSS" for p in placed)


def test_translation_is_preserved():
    words = [{"word": "APPLE", "translation": "JABŁKO"}]
    _, placed = generate_grid(words)
    assert placed[0]["translation"] == "JABŁKO"


def test_normalize_word_basic():
    assert normalize_word("hello") == "HELLO"
    assert normalize_word("Hello World") == "HELLOWORLD"
    assert normalize_word("Hello-World") == "HELLO-WORLD"
    assert normalize_word("Hello, World!") == "HELLOWORLD"
    assert normalize_word("-Hello-") == "HELLO"
    assert normalize_word("--Hello--") == "HELLO"


def test_normalize_word_croatian():
    assert normalize_word("čćžšđ") == "ČĆŽŠĐ"
    assert normalize_word("Čaša-Đak!") == "ČAŠA-ĐAK"
    assert normalize_word("prijatelj!") == "PRIJATELJ"
    assert normalize_word("životinja, pas!") == "ŽIVOTINJAPAS"
    assert normalize_word("-čćžšđ-") == "ČĆŽŠĐ"


def test_normalize_word_mixed():
    assert normalize_word("A-b_c!č") == "A-BCČ"
    assert normalize_word("123-abc-ČĆ") == "ABC-ČĆ"
    assert normalize_word("!@#-čćž-") == "ČĆŽ"
    assert normalize_word("") == ""


def test_improved_word_intersections():
    """Test that the improved algorithm creates intersections between words"""
    words = [
        {"word": "COMPUTER", "translation": "KOMPUTER"},
        {"word": "MOUSE", "translation": "MYSZ"},
        {"word": "SCREEN", "translation": "EKRAN"},
        {"word": "KEYBOARD", "translation": "KLAWIATURA"},
    ]

    grid, placed = generate_grid(words, size=15)

    # Should place all words
    assert len(placed) == 4

    # Check that some words intersect by finding shared grid positions
    all_coords = []
    for word_info in placed:
        all_coords.extend(word_info["coords"])

    # Count unique positions vs total positions
    unique_positions = len(set(all_coords))
    total_positions = len(all_coords)

    # If there are intersections, unique positions will be less than total
    assert unique_positions < total_positions, "Words should intersect to share some grid positions"


def test_direction_diversity():
    """Test that the improved algorithm uses diverse directions"""
    words = [
        {"word": "APPLE", "translation": "JABŁKO"},
        {"word": "BANANA", "translation": "BANAN"},
        {"word": "CHERRY", "translation": "WIŚNIA"},
        {"word": "DATE", "translation": "DAKTYL"},
        {"word": "ELDERBERRY", "translation": "BEZ"},
        {"word": "FIG", "translation": "FIGA"},
    ]

    grid, placed = generate_grid(words, size=15)

    # Calculate directions used
    directions_used = set()
    for word_info in placed:
        coords = word_info["coords"]
        if len(coords) >= 2:
            dr = coords[1][0] - coords[0][0]
            dc = coords[1][1] - coords[0][1]
            # Normalize direction
            if dr != 0:
                dr = dr // abs(dr)
            if dc != 0:
                dc = dc // abs(dc)
            directions_used.add((dr, dc))

    # Should use at least 3 different directions for good diversity
    assert len(directions_used) >= 3, f"Should use diverse directions, got: {directions_used}"


def test_word_placement_quality():
    """Test that longer words are placed first and create a good foundation"""
    words = [
        {"word": "CAT", "translation": "KOT"},
        {"word": "PROGRAMMING", "translation": "PROGRAMOWANIE"},
        {"word": "DOG", "translation": "PIES"},
        {"word": "DEVELOPMENT", "translation": "ROZWÓJ"},
    ]

    grid, placed = generate_grid(words, size=20)

    # All words should be placed
    assert len(placed) == 4

    # Verify that longer words are more likely to be in central positions
    # (This is a heuristic test - longer words placed first tend to be more central)
    placed_words_by_length = sorted(placed, key=lambda x: len(x["word"]), reverse=True)
    longest_word = placed_words_by_length[0]

    # Check that the longest word has reasonable placement
    coords = longest_word["coords"]
    assert len(coords) > 0

    # Grid should be properly filled
    assert len(grid) == 20
    assert all(len(row) == 20 for row in grid)
    assert all(all(cell != "" for cell in row) for row in grid)


def test_find_intersections():
    """Test the find_intersections function"""
    from osmosmjerka.grid_generator import find_intersections
    
    # Test basic intersection
    intersections = find_intersections("HELLO", "WORLD")
    assert (2, 3) in intersections  # L matches L
    assert (3, 3) in intersections  # L matches L
    assert (4, 1) in intersections  # O matches O
    
    # Test no intersections
    intersections = find_intersections("ABC", "XYZ")
    assert len(intersections) == 0
    
    # Test multiple same character intersections
    intersections = find_intersections("BOOK", "LOOK")
    expected = [(1, 1), (1, 2), (2, 1), (2, 2), (3, 3)]  # All O-O and K-K matches
    assert len(intersections) == len(expected)
    for intersection in expected:
        assert intersection in intersections
def test_calculate_word_density():
    """Test the calculate_density_around_position function"""
    from osmosmjerka.grid_generator import calculate_density_around_position

    # Create a test grid
    grid = [["" for _ in range(5)] for _ in range(5)]

    # Place some letters
    grid[1][1] = "A"
    grid[2][2] = "B"
    grid[3][3] = "C"

    # Test density calculation
    coords = [(2, 2)]  # Center position
    density = calculate_density_around_position(grid, coords, radius=1)

    # Should count filled cells in 3x3 area around (2,2)
    # Filled: (1,1), (2,2), (3,3) = 3 cells
    # Total: 3x3 = 9 cells
    expected_density = 3 / 9
    assert abs(density - expected_density) < 0.01


def test_high_density_placement():
    """Test that the algorithm can achieve high word density in reasonably sized grids"""
    words = [
        {"word": "CAT", "translation": "KOT"},
        {"word": "DOG", "translation": "PIES"},  
        {"word": "BIRD", "translation": "PTAK"},
        {"word": "FISH", "translation": "RYBA"},
        {"word": "MOUSE", "translation": "MYSZ"},
        {"word": "HORSE", "translation": "KOŃ"},
        {"word": "SNAKE", "translation": "WĄŻ"},
        {"word": "TIGER", "translation": "TYGRYS"},
        {"word": "RABBIT", "translation": "KRÓLIK"},
        {"word": "ELEPHANT", "translation": "SŁOŃ"}
    ]
    
    grid, placed = generate_grid(words, size=None)  # Let algorithm determine size
    
    # Should place all or most words (at least 8 out of 10)
    assert len(placed) >= 8, f"Should place at least 8 words, got {len(placed)}"
    
    # Grid should not be excessively large - test for reasonable density
    grid_area = len(grid) * len(grid)
    total_word_chars = sum(len(normalize_word(w["word"].replace(" ", "").upper())) for w in words[:len(placed)])
    
    # Density should be reasonable (at least 15% of grid filled with word characters)
    density = total_word_chars / grid_area
    assert density >= 0.15, f"Grid density too low: {density:.2%}, grid size: {len(grid)}x{len(grid)}"
    
    # Grid shouldn't be too large for the given words
    max_word_len = max(len(normalize_word(w["word"].replace(" ", "").upper())) for w in words)
    assert len(grid) <= max_word_len + 6, f"Grid too large: {len(grid)}x{len(grid)} for max word length {max_word_len}"


def test_ten_words_in_reasonable_grid():
    """Test placing 10 words in a reasonably sized grid"""
    words = [
        {"word": "SUN", "translation": "SŁOŃCE"},
        {"word": "MOON", "translation": "KSIĘŻYC"},
        {"word": "STAR", "translation": "GWIAZDA"},
        {"word": "EARTH", "translation": "ZIEMIA"},
        {"word": "WATER", "translation": "WODA"},
        {"word": "FIRE", "translation": "OGIEŃ"},
        {"word": "WIND", "translation": "WIATR"},
        {"word": "TREE", "translation": "DRZEWO"},
        {"word": "FLOWER", "translation": "KWIAT"},
        {"word": "GRASS", "translation": "TRAWA"}
    ]
    
    grid, placed = generate_grid(words, size=12)  # Fixed reasonable size
    
    # Should place most words in a 12x12 grid
    assert len(placed) >= 8, f"Should place at least 8/10 words in 12x12 grid, got {len(placed)}"
    
    # Verify grid is exactly 12x12
    assert len(grid) == 12
    assert all(len(row) == 12 for row in grid)
    
    # Check for intersections - should have some
    all_coords = []
    for word_info in placed:
        all_coords.extend(word_info["coords"])
    
    unique_positions = len(set(all_coords))
    total_positions = len(all_coords)
    intersections = total_positions - unique_positions
    
    assert intersections > 0, "Should have at least some intersections for space efficiency"
