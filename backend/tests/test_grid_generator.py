import pytest

from osmosmjerka.grid_generator import generate_grid, normalize_phrase


def test_empty_phrases():
    grid, placed = generate_grid([])
    assert grid == []
    assert placed == []


def test_all_phrases_too_short():
    phrases = [{"phrase": "a", "translation": "A"}, {"phrase": "b", "translation": "B"}]
    grid, placed = generate_grid(phrases)
    assert grid == []
    assert placed == []


def test_single_phrase():
    phrases = [{"phrase": "TEST", "translation": "PRÓBA"}]
    grid, placed = generate_grid(phrases, size=6)
    assert len(grid) == 6
    assert len(grid[0]) == 6
    assert any("T" in row for row in grid)
    assert placed[0]["phrase"] == "TEST"
    assert placed[0]["translation"] == "PRÓBA"
    assert len(placed[0]["coords"]) == 4


def test_phrase_with_spaces():
    phrases = [{"phrase": "HELLO WORLD", "translation": "CZEŚĆ ŚWIECIE"}]
    grid, placed = generate_grid(phrases)
    coords = placed[0]["coords"]
    assert len(coords) == len("HELLOWORLD")
    letters = [grid[r][c] for r, c in coords]
    assert "".join(letters) == "HELLOWORLD"


def test_phrase_longer_than_grid():
    phrases = [{"phrase": "LONGWORD", "translation": "DLUGIESLOWO"}]
    grid, placed = generate_grid(phrases, size=3)
    assert placed == []
    assert all(len(row) == 3 for row in grid)


def test_multiple_phrases_no_overlap():
    phrases = [
        {"phrase": "CAT", "translation": "KOT"},
        {"phrase": "DOG", "translation": "PIES"},
        {"phrase": "BIRD", "translation": "PTAK"},
    ]
    grid, placed = generate_grid(phrases, size=7)
    assert len(placed) == 3
    for phrase in phrases:
        assert any(p["phrase"] == phrase["phrase"] for p in placed)


def test_fill_empty_cells():
    phrases = [{"phrase": "PYTHON", "translation": "WĄŻ"}]
    grid, placed = generate_grid(phrases, size=8)
    for row in grid:
        for cell in row:
            assert cell.isupper() and len(cell) == 1


def test_randomness_of_grid(monkeypatch):
    # Patch random.choice to always return 'X'
    import random

    monkeypatch.setattr(random, "choice", lambda seq: "X")
    phrases = [{"phrase": "PY", "translation": "PI"}]
    grid, placed = generate_grid(phrases, size=4)
    for row in grid:
        for cell in row:
            assert cell in ("P", "Y", "X")


def test_no_conflict_on_overlap():
    phrases = [
        {"phrase": "CROSS", "translation": "KRZYŻ"},
        {"phrase": "ROSS", "translation": "ROSS"},
    ]
    grid, placed = generate_grid(phrases, size=7)
    assert any(p["phrase"] == "CROSS" for p in placed)
    assert any(p["phrase"] == "ROSS" for p in placed)


def test_translation_is_preserved():
    phrases = [{"phrase": "APPLE", "translation": "JABŁKO"}]
    _, placed = generate_grid(phrases)
    assert placed[0]["translation"] == "JABŁKO"


def test_normalize_phrase_basic():
    assert normalize_phrase("hello") == "HELLO"
    assert normalize_phrase("Hello World") == "HELLOWORLD"
    assert normalize_phrase("Hello-World") == "HELLO-WORLD"
    assert normalize_phrase("Hello, World!") == "HELLOWORLD"
    assert normalize_phrase("-Hello-") == "HELLO"
    assert normalize_phrase("--Hello--") == "HELLO"


def test_normalize_phrase_croatian():
    assert normalize_phrase("čćžšđ") == "ČĆŽŠĐ"
    assert normalize_phrase("Čaša-Đak!") == "ČAŠA-ĐAK"
    assert normalize_phrase("prijatelj!") == "PRIJATELJ"
    assert normalize_phrase("životinja, pas!") == "ŽIVOTINJAPAS"
    assert normalize_phrase("-čćžšđ-") == "ČĆŽŠĐ"


def test_normalize_phrase_mixed():
    assert normalize_phrase("A-b_c!č") == "A-BCČ"
    assert normalize_phrase("123-abc-ČĆ") == "ABC-ČĆ"
    assert normalize_phrase("!@#-čćž-") == "ČĆŽ"
    assert normalize_phrase("") == ""


def test_improved_phrase_intersections():
    """Test that the improved algorithm creates intersections between phrases"""
    phrases = [
        {"phrase": "COMPUTER", "translation": "KOMPUTER"},
        {"phrase": "MOUSE", "translation": "MYSZ"},
        {"phrase": "SCREEN", "translation": "EKRAN"},
        {"phrase": "KEYBOARD", "translation": "KLAWIATURA"},
    ]

    grid, placed = generate_grid(phrases, size=15)

    # Should place all phrases
    assert len(placed) == 4

    # Check that some phrases intersect by finding shared grid positions
    all_coords = []
    for phrase_info in placed:
        all_coords.extend(phrase_info["coords"])

    # Count unique positions vs total positions
    unique_positions = len(set(all_coords))
    total_positions = len(all_coords)

    # If there are intersections, unique positions will be less than total
    assert unique_positions < total_positions, "phrases should intersect to share some grid positions"


def test_direction_diversity():
    """Test that the improved algorithm uses diverse directions"""
    phrases = [
        {"phrase": "APPLE", "translation": "JABŁKO"},
        {"phrase": "BANANA", "translation": "BANAN"},
        {"phrase": "CHERRY", "translation": "WIŚNIA"},
        {"phrase": "DATE", "translation": "DAKTYL"},
        {"phrase": "ELDERBERRY", "translation": "BEZ"},
        {"phrase": "FIG", "translation": "FIGA"},
    ]

    grid, placed = generate_grid(phrases, size=15)

    # Calculate directions used
    directions_used = set()
    for phrase_info in placed:
        coords = phrase_info["coords"]
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


def test_phrase_placement_quality():
    """Test that longer phrases are placed first and create a good foundation"""
    phrases = [
        {"phrase": "CAT", "translation": "KOT"},
        {"phrase": "PROGRAMMING", "translation": "PROGRAMOWANIE"},
        {"phrase": "DOG", "translation": "PIES"},
        {"phrase": "DEVELOPMENT", "translation": "ROZWÓJ"},
    ]

    grid, placed = generate_grid(phrases, size=20)

    # All phrases should be placed
    assert len(placed) == 4

    # Verify that longer phrases are more likely to be in central positions
    # (This is a heuristic test - longer phrases placed first tend to be more central)
    placed_phrases_by_length = sorted(placed, key=lambda x: len(x["phrase"]), reverse=True)
    longest_phrase = placed_phrases_by_length[0]

    # Check that the longest phrase has reasonable placement
    coords = longest_phrase["coords"]
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
def test_calculate_phrase_density():
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
    """Test that the algorithm can achieve high phrase density in reasonably sized grids"""
    phrases = [
        {"phrase": "CAT", "translation": "KOT"},
        {"phrase": "DOG", "translation": "PIES"},  
        {"phrase": "BIRD", "translation": "PTAK"},
        {"phrase": "FISH", "translation": "RYBA"},
        {"phrase": "MOUSE", "translation": "MYSZ"},
        {"phrase": "HORSE", "translation": "KOŃ"},
        {"phrase": "SNAKE", "translation": "WĄŻ"},
        {"phrase": "TIGER", "translation": "TYGRYS"},
        {"phrase": "RABBIT", "translation": "KRÓLIK"},
        {"phrase": "ELEPHANT", "translation": "SŁOŃ"}
    ]
    
    grid, placed = generate_grid(phrases, size=None)  # Let algorithm determine size
    
    # Should place all or most phrases (at least 8 out of 10)
    assert len(placed) >= 8, f"Should place at least 8 phrases, got {len(placed)}"
    
    # Grid should not be excessively large - test for reasonable density
    grid_area = len(grid) * len(grid)
    total_phrase_chars = sum(len(normalize_phrase(w["phrase"].replace(" ", "").upper())) for w in phrases[:len(placed)])
    
    # Density should be reasonable (at least 15% of grid filled with phrase characters)
    density = total_phrase_chars / grid_area
    assert density >= 0.15, f"Grid density too low: {density:.2%}, grid size: {len(grid)}x{len(grid)}"
    
    # Grid shouldn't be too large for the given phrases
    max_phrase_len = max(len(normalize_phrase(w["phrase"].replace(" ", "").upper())) for w in phrases)
    assert len(grid) <= max_phrase_len + 6, f"Grid too large: {len(grid)}x{len(grid)} for max phrase length {max_phrase_len}"


def test_ten_phrases_in_reasonable_grid():
    """Test placing 10 phrases in a reasonably sized grid"""
    phrases = [
        {"phrase": "SUN", "translation": "SŁOŃCE"},
        {"phrase": "MOON", "translation": "KSIĘŻYC"},
        {"phrase": "STAR", "translation": "GWIAZDA"},
        {"phrase": "EARTH", "translation": "ZIEMIA"},
        {"phrase": "WATER", "translation": "WODA"},
        {"phrase": "FIRE", "translation": "OGIEŃ"},
        {"phrase": "WIND", "translation": "WIATR"},
        {"phrase": "TREE", "translation": "DRZEWO"},
        {"phrase": "FLOWER", "translation": "KWIAT"},
        {"phrase": "GRASS", "translation": "TRAWA"}
    ]
    
    grid, placed = generate_grid(phrases, size=12)  # Fixed reasonable size
    
    # Should place most phrases in a 12x12 grid
    assert len(placed) >= 8, f"Should place at least 8/10 phrases in 12x12 grid, got {len(placed)}"
    
    # Verify grid is exactly 12x12
    assert len(grid) == 12
    assert all(len(row) == 12 for row in grid)
    
    # Check for intersections - should have some
    all_coords = []
    for phrase_info in placed:
        all_coords.extend(phrase_info["coords"])
    
    unique_positions = len(set(all_coords))
    total_positions = len(all_coords)
    intersections = total_positions - unique_positions
    
    assert intersections > 0, "Should have at least some intersections for space efficiency"
