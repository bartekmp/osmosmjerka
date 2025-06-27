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
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} (id INTEGER PRIMARY KEY, categories TEXT, word TEXT UNIQUE, translation TEXT)"
    )
    conn.commit()
    conn.close()


def get_words_by_category(category, ignored_categories=None):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"SELECT word, translation, categories FROM {TABLE_NAME}")
    rows = cursor.fetchall()
    conn.close()

    words = []
    for word, translation, categories in rows:
        cats_set = set(categories.split())
        if ignored_categories and cats_set.intersection(ignored_categories):
            continue
        if category in cats_set:
            words.append({"word": word, "translation": translation})
    return words


def get_categories(ignored_categories=None):
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


def insert_words(content):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    for line in content.splitlines():
        parts = line.strip().split("\t")
        if len(parts) == 3:
            categories, word, translation = parts
            try:
                cursor.execute(
                    f"INSERT INTO {TABLE_NAME} (categories, word, translation) VALUES (?, ?, ?)",
                    (categories, word, translation),
                )
            except sqlite3.IntegrityError:
                continue
    conn.commit()
    conn.close()


def get_all_words(offset: int = 0, limit: int = 20):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT id, categories, word, translation FROM {TABLE_NAME} LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = cursor.fetchall()
    conn.close()
    return rows


def add_word(categories, word, translation):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"INSERT INTO {TABLE_NAME} (categories, word, translation) VALUES (?, ?, ?)",
        (categories, word, translation),
    )
    conn.commit()
    conn.close()


def update_word(id, categories, word, translation):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"UPDATE {TABLE_NAME} SET categories=?, word=?, translation=? WHERE id=?",
        (categories, word, translation, id),
    )
    conn.commit()
    conn.close()


def delete_word(id):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {TABLE_NAME} WHERE id=?", (id,))
    conn.commit()
    conn.close()


def delete_all_words():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {TABLE_NAME}")
    conn.commit()
    conn.close()
