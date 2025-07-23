import os
import sqlite3

from dotenv import load_dotenv

load_dotenv()

DATABASE_FILE = "/app/db/words.db"
TABLE_NAME = "words"

IGNORED_CATEGORIES = set(c.strip() for c in os.getenv("IGNORED_CATEGORIES", "").split(",") if c.strip())


def init_db():
    """Initialize the database and create the words table if it doesn't exist."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} (id INTEGER PRIMARY KEY, categories TEXT, word TEXT UNIQUE, translation TEXT)"
    )
    conn.commit()
    conn.close()


def get_words_by_category(category: str, ignored_categories: set | None = None) -> list[dict]:
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
    If the word already exists, it will be skipped.
    If any line does not match the expected format, the transaction will be rolled back and an error message will be returned.
    Args:
        content (str): The content string containing words, translations, and categories.
    Returns:
        tuple: (success: bool, error_message: str | None)
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    try:
        conn.execute("BEGIN")
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
                except sqlite3.IntegrityError as e:
                    conn.rollback()
                    conn.close()
                    return False, f"Integrity error on word '{word}': {e}"
            else:
                conn.rollback()
                conn.close()
                return False, f"Invalid line format: {line}"
        conn.commit()
        conn.close()
        return True, None
    except Exception as e:
        conn.rollback()
        conn.close()
        return False, str(e)


def get_all_words(offset: int = 0, limit: int | None = 20, category: str | None = None) -> tuple[list[tuple], int]:
    """Retrieve all words from the database with optional pagination and optional category filter.
    Args:
        offset (int): The starting point for pagination.
        limit (int | None): The maximum number of results to return. If None, return all results.
        category (str | None): The category to filter words by. If None, return all words.
    Returns:
        tuple: A tuple containing a list of rows (each row is a tuple of id, categories, word, translation) and the total count of words.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    base_query = f"SELECT id, categories, word, translation FROM {TABLE_NAME}"
    count_query = f"SELECT COUNT(*) FROM {TABLE_NAME}"
    params = []
    where_clause = ""

    # If a category is specified, add a WHERE clause to filter by categories
    if category:
        where_clause = " WHERE categories LIKE ?"
        params.append(f"%{category}%")

    # Compose main queries
    main_query = base_query + where_clause
    count_query = count_query + where_clause

    # Add pagination to the query if limit or offset is specified
    if limit is not None:
        main_query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    elif offset:
        main_query += " OFFSET ?"
        params.append(offset)

    cursor.execute(main_query, params)
    rows = cursor.fetchall()

    # Prepare parameters for the count query (only category filter if present)
    count_params = params[:1] if category else []
    cursor.execute(count_query, count_params)
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
