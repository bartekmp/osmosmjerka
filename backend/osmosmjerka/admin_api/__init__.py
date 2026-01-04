"""Admin API router that registers all admin endpoints"""

from fastapi import APIRouter
from osmosmjerka.admin_api import batch_operations, language_sets, phrases, settings, statistics, teacher_sets, users

router = APIRouter(prefix="/admin")

# Register all module routers
router.include_router(language_sets.router, tags=["Language Sets"])
router.include_router(phrases.router, tags=["Phrases"])
router.include_router(batch_operations.router, tags=["Batch Operations"])
router.include_router(users.router, tags=["Users & Auth"])
router.include_router(statistics.router, tags=["Statistics"])
router.include_router(settings.router, tags=["Settings"])
router.include_router(teacher_sets.router, tags=["Teacher Mode"])

__all__ = ["router"]
