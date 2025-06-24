import io
import random

from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from utils import export_to_docx

from db import get_categories, get_words_by_category, init_db, insert_words
from wordsearch import generate_grid

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)


@app.route("/api/categories")
def get_all_categories():
    return jsonify(get_categories())


@app.route("/api/words")
def get_words():
    if "category" not in request.args:
        category = random.choice(get_categories())
    else:
        category = request.args.get("category")
    words = get_words_by_category(category)
    selected = random.sample(words, min(10, max(15, len(words))))
    grid, placed_words = generate_grid(selected)
    return jsonify({"grid": grid, "words": placed_words})


@app.route("/api/upload", methods=["POST"])
def upload():
    file = request.files["file"]
    content = file.read().decode("utf-8")
    insert_words(content)
    return "Uploaded", 200


@app.route("/api/export", methods=["POST"])
def export():
    data = request.get_json()
    docx_bytes = export_to_docx(data["category"], data["grid"], data["words"])
    return send_file(
        io.BytesIO(docx_bytes),
        as_attachment=True,
        download_name=f"wordsearch-{data["category"]}.docx",
    )


@app.route("/")
def root():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8085)
