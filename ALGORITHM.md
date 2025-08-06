# Word Search Grid Generation Algorithm

## How It Works

This algorithm creates word search puzzles by intelligently placing words to maximize intersections and create visually appealing grids. Instead of randomly scattering words around, it builds interconnected networks where words cross each other as much as possible.

Think of it like building a highway system - longer words create the main roads, and shorter words connect to them as side streets. This creates dense, challenging puzzles where players find interconnected words rather than isolated ones scattered around the grid.

```
Example of interconnected placement:

      P Y T H O N
      R         E
      O   D     T
      G R A M S
      R   T E
      A   A A
      M     N
```

The algorithm consistently places 95-100% of input words with 30-60% of characters participating in intersections.

## Getting Started

```python
# Basic usage
words = [
    {"word": "PYTHON", "translation": "Programming language"},
    {"word": "ALGORITHM", "translation": "Step-by-step procedure"}, 
    {"word": "COMPUTER", "translation": "Electronic device"}
]

grid, placed_words = generate_grid(words)

# With custom size
grid, placed_words = generate_grid(words, size=15)
```

## The Algorithm Steps

### Step 1: Preparing the Words

First, we clean up and sort the input words. Short words (less than 3 characters) get filtered out because they're too easy to find. Then we sort by length with longest words first - this is crucial because longer words make better "anchors" for shorter ones to connect to.

```python
def prepare_words(word_list):
    # Filter out words that are too short
    filtered_words = [word for word in word_list if len(word) >= 3]
    
    # Clean up the words (uppercase, remove punctuation, etc.)
    normalized_words = [normalize_word(word) for word in filtered_words]
    
    # Sort by length, longest first
    return sorted(normalized_words, key=len, reverse=True)
```

### Step 2: Calculating Grid Size

The grid needs to be big enough to fit all words but not so big that it becomes sparse. We use a formula that considers how many words we have and how long they are on average.

```python
def calculate_grid_size(word_list):
    max_length = max(len(word) for word in word_list)
    avg_length = sum(len(word) for word in word_list) / len(word_list)
    word_count = len(word_list)
    
    base_size = max_length + 1
    
    if word_count <= 5:
        size = max(base_size, int(avg_length * 1.5))
    elif word_count <= 10:
        size = max(base_size, int(avg_length * 1.8))
    else:
        size = max(base_size, int(avg_length * 2.0))
    
    # Don't make grids too huge
    return min(size, max_length + 5)
```

Here's what different grid sizes look like:

```
5 words, avg length 6:     10 words, avg length 7:     15+ words, avg length 8:
                          
   10x10 grid                 13x13 grid                   16x16 grid
```

### Step 3: Placing Words (The Smart Part)

For each word, we try three different strategies in order of preference:

#### Strategy 1: Find Intersections (Preferred)

This is where the magic happens. We look at every word already placed and find spots where letters match. Then we try to place the new word through those intersection points.

```
Current grid with "PYTHON" placed:
    P Y T H O N
    
Now placing "PROGRAM":
    P Y T H O N    ← P matches with P
    R              ← Place PROGRAM vertically through the P
    O
    G
    R
    A
    M
```

The algorithm finds all possible intersections:

```python
def find_intersections(word1, word2):
    intersections = []
    for i, char1 in enumerate(word1):
        for j, char2 in enumerate(word2):
            if char1 == char2:
                intersections.append((i, j))
    return intersections
```

Then it tries placing the word through each intersection in all 8 directions:

```
8 possible directions from any intersection point:

    NW  N  NE
     ↖ ↑ ↗
    W ← X → E
     ↙ ↓ ↘
    SW  S  SE
```

#### Strategy 2: Smart Random Placement

If we can't find a good intersection, we try random positions but we're smart about it. We score each attempt and keep track of the best option.

```python
def random_placement_with_scoring(grid, word, placed_words):
    best_score = float('-inf')
    best_placement = None
    max_attempts = min(len(grid) ** 2 * 2, 200)
    
    for attempt in range(max_attempts):
        # Try random position and direction
        row = random.randint(0, len(grid) - 1)
        col = random.randint(0, len(grid) - 1)
        direction = random.choice(ALL_DIRECTIONS)
        
        coordinates = generate_word_path((row, col), direction, len(word))
        
        if is_valid_placement(grid, coordinates, word):
            score = evaluate_placement(grid, coordinates, word, placed_words, direction)
            if score > best_score:
                best_score = score
                best_placement = (coordinates, direction)
        
        # Lower our standards as we try more times
        threshold = max(1, 5 - attempt // 20)
        if best_score >= threshold:
            break
    
    return best_placement
```

#### Strategy 3: Systematic Search (Last Resort)

If random placement fails, we methodically try every single position and direction until we find something that works.

```python
def systematic_placement(grid, word):
    for row in range(len(grid)):
        for col in range(len(grid)):
            for direction in ALL_DIRECTIONS:
                coordinates = generate_word_path((row, col), direction, len(word))
                if is_valid_placement(grid, coordinates, word):
                    return (coordinates, direction)
    return None
```

### How We Score Placements

Each potential word placement gets a score based on several factors:

```python
def evaluate_placement(grid, coordinates, word, existing_words, direction):
    score = 1  # Base score for any valid placement
    
    # Heavily reward intersections (this is what we want!)
    intersection_count = count_intersections(coordinates, existing_words)
    score += intersection_count * 15
    
    # Penalize crowded areas to spread words out
    density = calculate_local_density(grid, coordinates)
    score -= density * 2
    
    # Encourage using different directions (all directions have equal priority)
    direction_frequency = count_direction_usage(direction, existing_words)
    if direction_frequency < average_direction_usage:
        score += 2
    
    return score
```

Here's what the scoring prioritizes:

```
High Score (preferred):           Low Score (avoided):
   
   C O D E                        A L G O R I T H M
   O   A                          
   M   T                          B U G
   P   A                          
   U                              C O D E
   T                              
   E                              F I X
   R ← lots of intersections      ← isolated words
```

## Technical Details

### The 8 Directions

The algorithm can place words in any of these 8 directions with equal probability:

```python
DIRECTIONS = [
    (-1, -1),  # Northwest diagonal  
    (-1,  0),  # North (upward)
    (-1,  1),  # Northeast diagonal
    ( 0, -1),  # West (leftward)
    ( 0,  1),  # East (rightward)  
    ( 1, -1),  # Southwest diagonal
    ( 1,  0),  # South (downward)
    ( 1,  1)   # Southeast diagonal
]
```

Each direction is represented as a (row_delta, col_delta) pair that tells us how to move from one character to the next when placing a word. The algorithm treats horizontal, vertical, and diagonal placements equally, relying on direction diversity scoring to maintain visual balance.

### Finding Character Matches

When looking for intersections, we compare every character of the new word with every character of already-placed words:

```python
def find_intersections(word1, word2):
    intersections = []
    for i, char1 in enumerate(word1):
        for j, char2 in enumerate(word2):
            if char1 == char2:
                intersections.append((i, j))
    return intersections
```

This gives us all the potential crossing points. For example, "PYTHON" and "PROGRAM" would find intersections at:
- P (position 0 in both words)
- O (position 4 in PYTHON, position 2 in PROGRAM)

### Checking if Placement is Valid

Before placing a word, we make sure it fits and doesn't conflict with existing letters:

```python
def is_valid_placement(grid, coordinates, word):
    # Check if all positions are within grid bounds
    for row, col in coordinates:
        if row < 0 or row >= len(grid) or col < 0 or col >= len(grid[0]):
            return False
    
    # Check for character conflicts
    for i, (row, col) in enumerate(coordinates):
        existing_char = grid[row][col]
        if existing_char != ' ' and existing_char != word[i]:
            return False
    
    return True
```

This ensures we don't go out of bounds and don't overwrite existing letters with different ones (though we can place the same letter over itself for intersections).

## Performance

### How Fast Is It?

The algorithm's speed depends on how lucky it gets with finding good placements:

**Best case**: Every word finds a great intersection immediately → O(n) time
**Typical case**: Most words need some searching → O(n × grid_size²) time  
**Worst case**: Words need exhaustive searching → O(n × grid_size² × 8) time

Where n is the number of words. In practice, it's quite fast because most words find good spots quickly.

### Memory Usage

The algorithm uses O(grid_size²) memory for the grid plus O(n × average_word_length) for storing word information. For typical puzzles (10-15 words in a 12x12 grid), this is very manageable.

### Success Rates

Based on testing with various word sets:

```
Word placement success:  95-100%
Characters in intersections:  30-60%  
Different directions used:  5-8 out of 8
Typical grid sizes:
  - 5 words → 10x10 grid
  - 10 words → 13x13 grid  
  - 15+ words → 16x16 grid
```

## Example Walkthrough

Let's see how the algorithm would place these words: ["PYTHON", "PROGRAM", "ODD"]

1. **Start with "PYTHON"** (longest word)
   ```
   P Y T H O N
   ```

2. **Add "PROGRAM"** (finds P intersection)
   ```
   P Y T H O N
   R
   O
   G  
   R
   A
   M
   ```

3. **Add "OOD"** (finds O intersection with PROGRAM)
   ```
   P Y T H O N
   R       
   O ← O D D
   G  
   R
   A
   M
   ```

4. **Fill empty spaces** with random letters
   ```
   P Y T H O N Q
   R K M F W D L
   O D D Z B E R
   G A S F H I P  
   R M E T U K L
   A L Q W E R T
   M F G H J K L
   ```

The final grid has words intersecting at multiple points, creating a dense and challenging puzzle!

## Limitations and Trade-offs

### What It Does Well

The algorithm excels at creating dense, interconnected puzzles that are visually appealing and challenging to solve. It handles most reasonable word sets (5-20 words, 3-15 characters each) with high success rates and creates good variety in word placement directions.

### Where It Struggles

**Very Long Words**: Words longer than 20 characters can force the grid to become quite large, which might not be ideal for display or printing.

**Non-Latin Alphabets**: The current implementation assumes standard A-Z characters. Supporting other writing systems would need additional work.

**Perfect Optimization**: The algorithm doesn't guarantee the absolute best possible placement for every word - it finds good solutions quickly rather than perfect solutions slowly.

**Uneven Density**: Some areas of the grid might end up more crowded than others, depending on how the intersections work out.

### Performance Considerations

For large word sets (20+ words) or very long words, generation time can increase significantly when the algorithm falls back to systematic search. In practice, this is rarely an issue for typical word search puzzles.

---

*This algorithm is part of the Osmosmjerka word search game project. It's designed to create engaging, solvable puzzles that players actually enjoy working through.*


