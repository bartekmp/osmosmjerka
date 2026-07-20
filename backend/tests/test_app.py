# isort: skip_file
import sys
from unittest.mock import AsyncMock

import pytest

import starlette.staticfiles

import osmosmjerka.app as app_module
from osmosmjerka.app import app, ensure_demo_account
from fastapi.testclient import TestClient


# Patch StaticFiles before importing app
class DummyStaticFiles:
    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, scope):
        pass


starlette.staticfiles.StaticFiles = DummyStaticFiles
sys.modules.pop("osmosmjerka.app", None)


@pytest.fixture
def client():
    return TestClient(app)


def test_main_app_structure():
    """Test that the main app imports correctly and includes the expected routers"""
    from osmosmjerka.app import app

    # Check that the app object exists and is a FastAPI instance
    assert app is not None
    assert hasattr(app, "routes")

    # Check that we have routes registered (from the routers)
    assert len(app.routes) > 0


def test_game_api_module_exists():
    """Test that the game_api module can be imported"""
    from osmosmjerka.game_api import router, get_grid_size_and_num_phrases

    assert router is not None
    assert hasattr(router, "prefix")
    assert router.prefix == "/api"
    assert callable(get_grid_size_and_num_phrases)


def test_admin_api_module_exists():
    """Test that the admin_api module can be imported"""
    from osmosmjerka.admin_api import router

    assert router is not None
    assert hasattr(router, "prefix")
    assert router.prefix == "/admin"


def test_get_grid_size_and_num_phrases_function():
    """Test the helper function works correctly"""
    from osmosmjerka.game_api import get_grid_size_and_num_phrases

    # Test easy difficulty
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "easy")
    assert size == 10 and num_phrases == 7

    # Test medium difficulty (new)
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "medium")
    assert size == 13 and num_phrases == 10

    # Test hard difficulty (previously medium)
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 15, "hard")
    assert size == 15 and num_phrases == 12

    # Test very_hard difficulty (previously hard)
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 20, "very_hard")
    assert size == 20 and num_phrases == 16

    # Test unknown difficulty defaults to easy
    size, num_phrases = get_grid_size_and_num_phrases([{"phrase": "a"}] * 10, "unknown")
    assert size == 10 and num_phrases == 7


@pytest.mark.asyncio
async def test_ensure_demo_account_noop_when_unconfigured(monkeypatch):
    """Prod (and any env that just doesn't set these two vars) must never get a demo account."""
    monkeypatch.setattr(app_module, "DEMO_USERNAME", "")
    monkeypatch.setattr(app_module, "DEMO_PASSWORD_HASH", "")
    mock_db = AsyncMock()
    monkeypatch.setattr(app_module, "db_manager", mock_db)

    await ensure_demo_account()()

    mock_db.get_account_by_username.assert_not_called()
    mock_db.create_account.assert_not_called()


@pytest.mark.asyncio
async def test_ensure_demo_account_creates_when_missing(monkeypatch):
    monkeypatch.setattr(app_module, "DEMO_USERNAME", "demo")
    monkeypatch.setattr(app_module, "DEMO_PASSWORD_HASH", "hashed-demo-pw")
    mock_db = AsyncMock()
    mock_db.get_account_by_username.return_value = None
    monkeypatch.setattr(app_module, "db_manager", mock_db)

    await ensure_demo_account()()

    mock_db.create_account.assert_called_once_with(
        username="demo",
        password_hash="hashed-demo-pw",
        role="regular",
        self_description="Demo account",
    )
    mock_db.update_account.assert_not_called()


@pytest.mark.asyncio
async def test_ensure_demo_account_refreshes_stale_password_hash(monkeypatch):
    monkeypatch.setattr(app_module, "DEMO_USERNAME", "demo")
    monkeypatch.setattr(app_module, "DEMO_PASSWORD_HASH", "new-hash")
    mock_db = AsyncMock()
    mock_db.get_account_by_username.return_value = {"id": 7, "password_hash": "old-hash"}
    monkeypatch.setattr(app_module, "db_manager", mock_db)

    await ensure_demo_account()()

    mock_db.create_account.assert_not_called()
    mock_db.update_account.assert_called_once_with(7, password_hash="new-hash")


@pytest.mark.asyncio
async def test_ensure_demo_account_leaves_matching_account_untouched(monkeypatch):
    monkeypatch.setattr(app_module, "DEMO_USERNAME", "demo")
    monkeypatch.setattr(app_module, "DEMO_PASSWORD_HASH", "same-hash")
    mock_db = AsyncMock()
    mock_db.get_account_by_username.return_value = {"id": 7, "password_hash": "same-hash"}
    monkeypatch.setattr(app_module, "db_manager", mock_db)

    await ensure_demo_account()()

    mock_db.create_account.assert_not_called()
    mock_db.update_account.assert_not_called()
