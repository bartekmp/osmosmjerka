import os
import sqlite3

from dotenv import load_dotenv

load_dotenv()

DATABASE_FILE = "/app/db/words.db"
TABLE_NAME = "words"

IGNORED_CATEGORIES = set(
    c.strip() for c in os.getenv("IGNORED_CATEGORIES", "").split(",") if c.strip()
)


def init_db():
    """Initialize the database and create the words table if it doesn't exist."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} (id INTEGER PRIMARY KEY, categories TEXT, word TEXT UNIQUE, translation TEXT)"
    )
    conn.commit()
    conn.close()


def get_words_by_category(
    category: str, ignored_categories: set | None = None
) -> list[dict]:
    """Retrieve words from the database by category.
    Args:
        category (str): The category to filter words by.
        ignored_categories (set, optional): Categories to ignore.
    Returns:
        list: A list of dictionaries containing words and their translations."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"SELECT word, translation, categories FROM {TABLE_NAME}")
    rows = cursor.fetchall()
    conn.close()

    words = []
    for word, translation, categories in rows:
        if len(word.strip()) < 3:
            continue  # Skip words shorter than 3 characters
        cats_set = set(categories.split())
        if ignored_categories and cats_set.intersection(ignored_categories):
            continue
        if category in cats_set:
            words.append({"word": word, "translation": translation})
    return words


def get_categories(ignored_categories: set | None = None) -> list[str]:
    """Retrieve all unique categories from the database.
    Args:
        ignored_categories (set, optional): Categories to ignore.
    Returns:
        list: A sorted list of unique categories."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"SELECT categories FROM {TABLE_NAME}")
    rows = cursor.fetchall()
    conn.close()

    all_cats = set()
    for (cat_str,) in rows:
        for cat in cat_str.split():
            if not ignored_categories or cat not in ignored_categories:
                all_cats.add(cat.strip())
    return sorted(all_cats)


def insert_words(content: str):
    """Insert words into the database from a given content string.
    The content should be formatted as 'word; translation; categories'.
    Args:
        content (str): The content string containing words, translations, and categories.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    for line in content.splitlines():
        parts = [p.strip() for p in line.strip().split(";")]
        if len(parts) == 3:
            word, translation, categories = parts
            cursor.execute(f"SELECT 1 FROM {TABLE_NAME} WHERE word = ?", (word,))
            if cursor.fetchone():
                continue
            try:
                cursor.execute(
                    f"INSERT INTO {TABLE_NAME} (categories, word, translation) VALUES (?, ?, ?)",
                    (categories, word, translation),
                )
            except sqlite3.IntegrityError:
                continue
        else:
            print(f"Invalid line format: {line}")
    conn.commit()
    conn.close()


def get_all_words(offset: int = 0, limit: int = 20, category: str | None = None) -> tuple[list[tuple], int]:
    """Retrieve all words from the database with pagination and optional category filter.
    Returns: (rows, total_rows)
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    if category:
        # Filtrowanie po kategorii (dokładne dopasowanie w stringu kategorii)
        cursor.execute(
            f"SELECT id, categories, word, translation FROM {TABLE_NAME} WHERE categories LIKE ? LIMIT ? OFFSET ?",
            (f"%{category}%", limit, offset),
        )
        rows = cursor.fetchall()
        cursor.execute(
            f"SELECT COUNT(*) FROM {TABLE_NAME} WHERE categories LIKE ?",
            (f"%{category}%",)
        )
        total = cursor.fetchone()[0]
    else:
        cursor.execute(
            f"SELECT id, categories, word, translation FROM {TABLE_NAME} LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = cursor.fetchall()
        cursor.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}")
        total = cursor.fetchone()[0]
    conn.close()
    return rows, total


def add_word(categories: str, word: str, translation: str):
    """Add a new word to the database.
    Args:
        categories (str): The categories associated with the word.
        word (str): The word to add.
        translation (str): The translation of the word.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"INSERT INTO {TABLE_NAME} (categories, word, translation) VALUES (?, ?, ?)",
        (categories, word, translation),
    )
    conn.commit()
    conn.close()


def update_word(id: int, categories: str, word: str, translation: str):
    """Update an existing word in the database.
    Args:
        id (int): The ID of the word to update.
        categories (str): The new categories for the word.
        word (str): The new word.
        translation (str): The new translation of the word.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"UPDATE {TABLE_NAME} SET categories=?, word=?, translation=? WHERE id=?",
        (categories, word, translation, id),
    )
    conn.commit()
    conn.close()


def delete_word(id: int):
    """Delete a word from the database by its ID.
    Args:
        id (int): The ID of the word to delete.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {TABLE_NAME} WHERE id=?", (id,))
    conn.commit()
    conn.close()


def delete_all_words():
    """Delete all words from the database."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {TABLE_NAME}")
    conn.commit()
    conn.close()
