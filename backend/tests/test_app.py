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


def test_main_app_structure():
    """Test that the main app imports correctly and includes the expected routers"""
    from osmosmjerka.app import app
    
    # Check that the app object exists and is a FastAPI instance
    assert app is not None
    assert hasattr(app, 'routes')
    
    # Check that we have routes registered (from the routers)
    assert len(app.routes) > 0


def test_game_api_module_exists():
    """Test that the game_api module can be imported"""
    from osmosmjerka.game_api import router, get_grid_size_and_num_phrases
    
    assert router is not None
    assert hasattr(router, 'prefix')
    assert router.prefix == "/api"
    assert callable(get_grid_size_and_num_phrases)


def test_admin_api_module_exists():
    """Test that the admin_api module can be imported"""
    from osmosmjerka.admin_api import router
    
    assert router is not None
    assert hasattr(router, 'prefix')
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
