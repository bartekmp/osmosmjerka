# isort: skip_file
import sys
import pytest


# Patch StaticFiles before importing app
class DummyStaticFiles:
    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, scope):
        pass


import starlette.staticfiles

starlette.staticfiles.StaticFiles = DummyStaticFiles
sys.modules.pop("osmosmjerka.app", None)

from osmosmjerka.app import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    return TestClient(app)


def test_get_all_categories(client, monkeypatch):
    # Patch the actual endpoint, not a global function
    async def fake_db_get_categories():
        return ["A", "B", "C"]
    monkeypatch.setattr("osmosmjerka.app.db_get_categories", fake_db_get_categories)
    monkeypatch.setattr("osmosmjerka.app.IGNORED_CATEGORIES", {"B"})
    response = client.get("/api/categories")
    assert response.status_code == 200
    assert response.json() == ["A", "C"]


def test_get_ignored_categories(client, monkeypatch):
    monkeypatch.setattr("osmosmjerka.app.IGNORED_CATEGORIES", {"X", "Y"})
    response = client.get("/admin/ignored-categories")
    assert response.status_code == 200
    assert set(response.json()) == {"X", "Y"}


def test_get_grid_size_and_num_words_easy():
    from osmosmjerka.app import get_grid_size_and_num_words

    size, num_words = get_grid_size_and_num_words([{"word": "a"}] * 10, "easy")
    assert size == 10 and num_words == 7


def test_get_grid_size_and_num_words_dynamic():
    from osmosmjerka.app import get_grid_size_and_num_words

    selected = [{"word": "abc def"}, {"word": "ghijk"}]
    size, num_words = get_grid_size_and_num_words(selected, "dynamic")
    assert size == 6
    assert num_words == 2


def test_get_words_invalid_difficulty(client, monkeypatch):
    async def fake_db_get_categories():
        return ["A"]
    async def fake_db_get_words(category, limit=None, offset=0):
        return [{"word": "a"}]
    monkeypatch.setattr("osmosmjerka.app.db_get_categories", fake_db_get_categories)
    monkeypatch.setattr("osmosmjerka.app.db_get_words", fake_db_get_words)
    response = client.get("/api/words?category=A&difficulty=invalid")
    assert response.status_code == 404
    assert ("Invalid difficulty" in response.text or "Not enough words" in response.text)


def test_get_words_not_enough_words(client, monkeypatch):
    async def fake_db_get_categories():
        return ["A"]
    async def fake_db_get_words(category, limit=None, offset=0):
        return [{"word": "a"}]
    monkeypatch.setattr("osmosmjerka.app.db_get_categories", fake_db_get_categories)
    monkeypatch.setattr("osmosmjerka.app.db_get_words", fake_db_get_words)
    response = client.get("/api/words?category=A&difficulty=hard")
    assert response.status_code == 404
    data = response.json()
    assert "Not enough words" in data.get("error", "")


def test_get_words_success(client, monkeypatch):
    async def fake_db_get_categories():
        return ["A"]
    async def fake_db_get_words(category, limit=None, offset=0):
        return [{"word": "a", "categories": "A", "translation": "a"}] * 20
    monkeypatch.setattr("osmosmjerka.app.db_get_categories", fake_db_get_categories)
    monkeypatch.setattr("osmosmjerka.app.db_get_words", fake_db_get_words)
    monkeypatch.setattr("osmosmjerka.app.generate_grid", lambda words, size: ([['A']], words))
    response = client.get("/api/words?category=A&difficulty=easy")
    assert response.status_code == 200
    data = response.json()
    assert "grid" in data and "words" in data


def test_export_to_docx_endpoint(client, monkeypatch):
    monkeypatch.setattr("osmosmjerka.app.export_to_docx", lambda category, grid, words: b"docxbytes")
    data = {"category": "Test", "grid": [["A"]], "words": [{"word": "A", "translation": "A"}]}
    response = client.post("/api/export", json=data)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_serve_spa(client, monkeypatch):
    # Should return index.html for non-api/admin paths
    monkeypatch.setattr("osmosmjerka.app.FileResponse", lambda path: "INDEX")
    response = client.get("/some/random/path")
    assert response.text == '"INDEX"'
    # Should return 404 for api/admin paths
    response = client.get("/api/something")
    assert response.status_code == 404
    response = client.get("/admin/something")
    assert response.status_code == 404
