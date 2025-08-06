import random
from typing import List, Tuple, Dict, Optional


def normalize_word(word: str) -> str:
    """
    Normalize a word by removing spaces, punctuation, and converting to uppercase.
    Only alphabetic characters (any language) and hyphens are kept, but the result cannot begin or end with a hyphen.
    
    Args:
        word (str): The word to normalize.
    Returns:
        str: The normalized word.
    """
    # Keep only alphabetic (any language) and hyphens
    result = ''.join(
        c.upper() for c in word if c.isalpha() or c == '-'
    )
    # Remove leading/trailing hyphens
    return result.strip('-')


def find_intersections(word1: str, word2: str) -> List[Tuple[int, int]]:
    """
    Find all possible intersection points between two words.
    
    Args:
        word1 (str): First word to check for intersections
        word2 (str): Second word to check for intersections
        
    Returns:
        List[Tuple[int, int]]: List of (pos1, pos2) tuples where word1[pos1] == word2[pos2]
    """
    intersections = []
    for i, char1 in enumerate(word1):
        for j, char2 in enumerate(word2):
            if char1 == char2:
                intersections.append((i, j))
    return intersections


def calculate_density_around_position(grid: List[List[str]], coords: List[Tuple[int, int]], radius: int = 2) -> float:
    """
    Calculate the density of placed letters around the given coordinates.
    This helps avoid placing words in already crowded areas.
    
    Args:
        grid: The current grid state
        coords: List of coordinates to check around
        radius: How many cells around each coordinate to check
        
    Returns:
        float: Density ratio (0.0 = empty, 1.0 = completely filled)
    """
    size = len(grid)
    total_cells = 0
    filled_cells = 0
    
    # Check area around each coordinate
    for r, c in coords:
        for dr in range(-radius, radius + 1):
            for dc in range(-radius, radius + 1):
                nr, nc = r + dr, c + dc
                if 0 <= nr < size and 0 <= nc < size:
                    total_cells += 1
                    if grid[nr][nc] != "":
                        filled_cells += 1
    
    return filled_cells / total_cells if total_cells > 0 else 0


def score_word_placement(grid: List[List[str]], word: str, coords: List[Tuple[int, int]], 
                        placed_words: List[Dict], direction: Tuple[int, int]) -> float:
    """
    Score a potential word placement to determine if it's a good fit.
    Higher scores indicate better placements.
    
    Scoring factors:
    - Intersections with existing words (heavily favored)
    - Density of surrounding area (slightly penalized if too crowded)
    - Direction diversity (bonus for less-used directions)
    - Basic placement bonus (encourages placing more words)
    
    Args:
        grid: Current grid state
        word: Word being placed
        coords: Proposed coordinates for the word
        placed_words: List of already placed words
        direction: Direction vector (dr, dc) for the placement
        
    Returns:
        float: Placement score (higher is better)
    """
    score = 0
    
    # Count intersections with existing words
    intersections = sum(1 for i, (r, c) in enumerate(coords) 
                       if grid[r][c] != "" and grid[r][c] == word[i])
    
    # Strong bonus for intersections (encourages crossing words)
    score += intersections * 15
    
    # Small penalty for placing in crowded areas (allows density but prevents extreme clustering)
    density = calculate_density_around_position(grid, coords)
    score -= density * 2
    
    # Calculate direction diversity bonus
    direction_usage = _count_direction_usage(placed_words)
    current_dir_count = direction_usage.get(direction, 0)
    score += max(0, 2 - current_dir_count)  # Bonus for less-used directions
    
    # Small bonus for any valid placement (encourages placing more words)
    score += 1
    
    return score


def _count_direction_usage(placed_words: List[Dict]) -> Dict[Tuple[int, int], int]:
    """
    Count how many times each direction has been used.
    Helper function for score_word_placement.
    """
    direction_counts = {}
    for placed in placed_words:
        coords = placed["coords"]
        if len(coords) >= 2:
            # Calculate direction vector
            dr = coords[1][0] - coords[0][0]
            dc = coords[1][1] - coords[0][1]
            # Normalize direction to unit vector
            if dr != 0:
                dr = dr // abs(dr)
            if dc != 0:
                dc = dc // abs(dc)
            direction = (dr, dc)
            direction_counts[direction] = direction_counts.get(direction, 0) + 1
    return direction_counts


def try_place_word_with_intersections(grid: List[List[str]], word: str, placed_words: List[Dict]) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Attempt to place a word by finding intersections with already placed words.
    This is the primary placement strategy that creates interconnected word networks.
    
    Args:
        grid: Current grid state
        word: Normalized word to place
        placed_words: List of already placed words with their coordinates
        
    Returns:
        Tuple of (coordinates, direction) if successful placement found, None otherwise
    """
    size = len(grid)
    best_placement = None
    best_score = -1
    
    # All possible directions for word placement
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    
    # Try to intersect with each already placed word
    for placed_word_info in placed_words:
        placed_word = normalize_word(placed_word_info["word"].replace(" ", "").upper())
        placed_coords = placed_word_info["coords"]
        
        # Find all possible intersection points between the two words
        intersections = find_intersections(word, placed_word)
        
        # Try each intersection point
        for word_pos, placed_pos in intersections:
            placed_r, placed_c = placed_coords[placed_pos]
            
            # Try placing the word in each direction from this intersection point
            for dr, dc in directions:
                # Calculate where the word would start
                start_r = placed_r - dr * word_pos
                start_c = placed_c - dc * word_pos
                
                # Generate all coordinates the word would occupy
                coords = [(start_r + dr * i, start_c + dc * i) for i in range(len(word))]
                
                # Check if this placement is valid
                if _is_valid_placement(grid, word, coords, size):
                    # Score this placement opportunity
                    score = score_word_placement(grid, word, coords, placed_words, (dr, dc))
                    if score > best_score:
                        best_score = score
                        best_placement = (coords, (dr, dc))
    
    return best_placement


def _is_valid_placement(grid: List[List[str]], word: str, coords: List[Tuple[int, int]], size: int) -> bool:
    """
    Check if a word can be placed at the given coordinates.
    Helper function for placement validation.
    """
    # Check bounds
    if not all(0 <= r < size and 0 <= c < size for r, c in coords):
        return False
    
    # Check conflicts (each position must be empty or match the word letter)
    return all(grid[r][c] in ("", word[i]) for i, (r, c) in enumerate(coords))


def try_systematic_placement(grid: List[List[str]], word: str, size: int, directions: List[Tuple[int, int]]) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Try systematic placement by checking all positions methodically.
    This is a fallback strategy when intersection-based placement fails.
    
    Args:
        grid: Current grid state
        word: Normalized word to place
        size: Grid size
        directions: List of direction vectors to try
        
    Returns:
        Tuple of (coordinates, direction) if successful placement found, None otherwise
    """
    word_len = len(word)
    
    # Try every position and direction systematically
    for row in range(size):
        for col in range(size):
            for dr, dc in directions:
                # Calculate end position
                end_r = row + dr * (word_len - 1)
                end_c = col + dc * (word_len - 1)
                
                # Check if word fits in bounds
                if 0 <= end_r < size and 0 <= end_c < size:
                    coords = [(row + dr * i, col + dc * i) for i in range(word_len)]
                    
                    # Check if placement is valid (no conflicts)
                    if all(grid[r][c] in ("", word[i]) for i, (r, c) in enumerate(coords)):
                        return (coords, (dr, dc))
    
    return None


def calculate_optimal_grid_size(word_pairs: List[Tuple[str, str]]) -> int:
    """
    Calculate the optimal grid size based on word characteristics.
    Balances between fitting all words and maintaining reasonable density.
    
    Args:
        word_pairs: List of (word, translation) tuples
        
    Returns:
        int: Optimal grid size (creates square grid)
    """
    normalized_words = [normalize_word(word.replace(" ", "").upper()) for word, _ in word_pairs]
    max_word_len = max(len(w) for w in normalized_words)
    avg_word_len = sum(len(w) for w in normalized_words) / len(normalized_words)
    word_count = len(normalized_words)
    
    # Base size ensures longest word fits
    base_size = max_word_len + 1
    
    # Scale based on word count and average length for better density
    if word_count <= 5:
        size = max(base_size, int(avg_word_len * 1.5))
    elif word_count <= 10:
        size = max(base_size, int(avg_word_len * 1.8))
    else:
        size = max(base_size, int(avg_word_len * 2.0))
    
    # Cap maximum size to prevent excessively large grids
    return min(size, max_word_len + 5)


def place_single_word(grid: List[List[str]], word_data: Tuple[str, str], placed_words: List[Dict]) -> bool:
    """
    Attempt to place a single word in the grid using the best available strategy.
    
    Placement strategy priority:
    1. Intersection with existing words (creates connected network)
    2. Random placement with scoring (finds good spots)
    3. Systematic placement (fallback to ensure placement)
    
    Args:
        grid: Current grid state (modified in place)
        word_data: Tuple of (original_word, translation)
        placed_words: List of already placed words (modified in place)
        
    Returns:
        bool: True if word was successfully placed, False otherwise
    """
    orig_word, translation = word_data
    word_normalized = normalize_word(orig_word.replace(" ", "").upper())
    size = len(grid)
    
    # Skip words that are too long for the grid
    if len(word_normalized) > size:
        return False
    
    # Strategy 1: Try intersection-based placement if we have existing words
    if placed_words:
        result = try_place_word_with_intersections(grid, word_normalized, placed_words)
        if result:
            coords, direction = result
            _place_word_on_grid(grid, word_normalized, coords)
            placed_words.append({"word": orig_word, "translation": translation, "coords": coords})
            return True
    
    # Strategy 2: Try random placement with scoring
    result = _try_random_placement_with_scoring(grid, word_normalized, placed_words)
    if result:
        coords, direction = result
        _place_word_on_grid(grid, word_normalized, coords)
        placed_words.append({"word": orig_word, "translation": translation, "coords": coords})
        return True
    
    # Strategy 3: Fallback to systematic placement
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    result = try_systematic_placement(grid, word_normalized, size, directions)
    if result:
        coords, direction = result
        _place_word_on_grid(grid, word_normalized, coords)
        placed_words.append({"word": orig_word, "translation": translation, "coords": coords})
        return True
    
    return False


def _try_random_placement_with_scoring(grid: List[List[str]], word: str, placed_words: List[Dict]) -> Optional[Tuple[List[Tuple[int, int]], Tuple[int, int]]]:
    """
    Try random placement with intelligent scoring.
    This balances randomness with strategic placement decisions.
    """
    size = len(grid)
    word_len = len(word)
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    
    best_placement = None
    best_score = -1
    max_attempts = min(size * size * 2, 200)  # Reasonable attempt limit
    
    for attempt in range(max_attempts):
        # Try random position and direction
        row = random.randint(0, size - 1)
        col = random.randint(0, size - 1)
        
        random.shuffle(directions)  # Try directions in random order
        for dr, dc in directions:
            # Check if word fits in this direction
            end_r = row + dr * (word_len - 1)
            end_c = col + dc * (word_len - 1)
            
            if 0 <= end_r < size and 0 <= end_c < size:
                coords = [(row + dr * i, col + dc * i) for i in range(word_len)]
                
                # Check if placement is valid
                if all(grid[r][c] in ("", word[i]) for i, (r, c) in enumerate(coords)):
                    score = score_word_placement(grid, word, coords, placed_words, (dr, dc))
                    if score > best_score:
                        best_score = score
                        best_placement = (coords, (dr, dc))
        
        # Use progressively lower thresholds to ensure eventual placement
        threshold = max(1, 5 - (attempt // 20))
        if best_score >= threshold:
            break
    
    return best_placement


def _place_word_on_grid(grid: List[List[str]], word: str, coords: List[Tuple[int, int]]) -> None:
    """
    Place a word on the grid at the specified coordinates.
    Helper function that modifies the grid in place.
    """
    for i, (r, c) in enumerate(coords):
        grid[r][c] = word[i]


def _fill_empty_cells_with_random_letters(grid: List[List[str]]) -> None:
    """
    Fill all empty cells in the grid with random letters.
    This makes the word search puzzle complete and challenging.
    """
    size = len(grid)
    for r in range(size):
        for c in range(size):
            if grid[r][c] == "":
                grid[r][c] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def generate_grid(words: list, size: int | None = None) -> tuple[list, list]:
    """
    Generate a word search grid with the given words and size.
    
    This is the main entry point for grid generation. The algorithm uses an intelligent
    placement strategy that prioritizes word intersections to create dense, interconnected
    word networks while maintaining good visual diversity.
    
    Algorithm Overview:
    1. Filter and prepare words (minimum 3 characters)
    2. Sort words by length (longest first for better foundation)
    3. Calculate optimal grid size if not provided
    4. Place each word using multi-strategy approach:
       - Intersection-based placement (preferred)
       - Random placement with scoring
       - Systematic placement (fallback)
    5. Fill remaining cells with random letters
    
    Args:
        words (list): List of dictionaries with "word" and "translation" keys
        size (int | None): Grid size. If None, calculated automatically for optimal density
        
    Returns:
        tuple: (grid, placed_words) where:
            - grid: 2D list of characters representing the word search grid
            - placed_words: List of dictionaries with word info and coordinates
    """
    # Step 1: Filter words (minimum 3 characters) and handle edge cases
    valid_words = [w for w in words if len(w["word"].strip()) >= 3]
    if not valid_words:
        return [], []
    
    # Step 2: Prepare and sort words (longest first for better placement foundation)
    word_pairs = [(w["word"], w["translation"]) for w in valid_words]
    word_pairs.sort(key=lambda x: len(normalize_word(x[0].replace(" ", "").upper())), reverse=True)
    
    # Step 3: Calculate optimal grid size
    grid_size = size if size is not None else calculate_optimal_grid_size(word_pairs)
    
    # Step 4: Initialize empty grid and placement tracking
    grid = [["" for _ in range(grid_size)] for _ in range(grid_size)]
    placed_words = []
    
    # Step 5: Place each word using intelligent multi-strategy approach
    for word_data in word_pairs:
        place_single_word(grid, word_data, placed_words)
    
    # Step 6: Fill empty cells with random letters to complete the puzzle
    _fill_empty_cells_with_random_letters(grid)
    
    return grid, placed_words
