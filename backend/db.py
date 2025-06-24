import sqlite3

DATABASE_FILE = "/app/db/words.db"
TABLE_NAME = "words"


def init_db():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} (id INTEGER PRIMARY KEY, category TEXT, word TEXT UNIQUE, translation TEXT)"
    )
    conn.commit()
    conn.close()


def get_words_by_category(category):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT word, translation FROM {TABLE_NAME} WHERE category = ?", (category,)
    )
    result = cursor.fetchall()
    conn.close()
    return result


def get_categories():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM words")
    categories = [row[0] for row in cursor.fetchall()]
    conn.close()
    return categories


def insert_words(content):
    import pdb
    pdb.set_trace()
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    for line in content.strip().splitlines():
        parts = line.strip().split(";")
        if len(parts) == 3:
            try:
                cursor.execute(
                    f"INSERT OR IGNORE INTO {TABLE_NAME} VALUES (?, ?, ?)",
                    (parts[0], parts[1], parts[2]),
                )
            except:
                continue
    conn.commit()
    conn.close()
