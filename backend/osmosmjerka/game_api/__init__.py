"""Game API module combining all endpoint routers."""

from fastapi import APIRouter
from osmosmjerka.database import db_manager
from osmosmjerka.game_api.export import router as export_router
from osmosmjerka.game_api.game_sessions import router as game_sessions_router
from osmosmjerka.game_api.helpers import _generate_grid_with_exact_phrase_count, get_grid_size_and_num_phrases
from osmosmjerka.game_api.list_sharing import router as list_sharing_router
from osmosmjerka.game_api.phrases import router as phrases_router
from osmosmjerka.game_api.private_lists import router as private_lists_router
from osmosmjerka.game_api.scoring import router as scoring_router
from osmosmjerka.game_api.user_preferences import router as user_preferences_router
from osmosmjerka.grid_generator import generate_grid
from osmosmjerka.utils import export_to_docx, export_to_png

# Create main router with /api prefix
router = APIRouter(prefix="/api")

# Include all sub-routers
router.include_router(phrases_router)
router.include_router(export_router)
router.include_router(user_preferences_router)
router.include_router(game_sessions_router)
router.include_router(scoring_router)
router.include_router(private_lists_router)
router.include_router(list_sharing_router)

# Export functions for backward compatibility with tests and other code
__all__ = [
    "router",
    "get_grid_size_and_num_phrases",
    "_generate_grid_with_exact_phrase_count",
    "db_manager",
    "generate_grid",
    "export_to_docx",
    "export_to_png",
]
