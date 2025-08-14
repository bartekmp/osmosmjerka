"""Admin API router that registers all admin endpoints"""

from fastapi import APIRouter

from osmosmjerka.admin_api import batch_operations, language_sets, phrases, users

router = APIRouter(prefix="/admin")

# Register all module routers
router.include_router(language_sets.router, tags=["Language Sets"])
router.include_router(phrases.router, tags=["Phrases"])
router.include_router(batch_operations.router, tags=["Batch Operations"])
router.include_router(users.router, tags=["Users & Auth"])

__all__ = ["router"]
