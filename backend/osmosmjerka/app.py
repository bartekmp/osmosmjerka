import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from osmosmjerka.admin_api import router as admin_router
from osmosmjerka.auth import ROOT_ADMIN_PASSWORD_HASH, ROOT_ADMIN_USERNAME
from osmosmjerka.database import db_manager
from osmosmjerka.game_api import router as game_router

# List of API endpoints that should be ignored for the SPA routing
API_ENDPOINTS = ["api/", "admin/"]

# Static file extensions that should not be handled by SPA routing
STATIC_FILE_EXTENSIONS = [
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".css",
    ".js",
    ".json",
    ".txt",
    ".xml",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
]

# Check if we're in development mode
DEVELOPMENT_MODE = os.getenv("DEVELOPMENT_MODE", "false").lower() == "true"
FRONTEND_DEV_URL = "http://localhost:3210"


# Initialize the FastAPI application
def ensure_root_admin_account():
    async def _ensure():
        if not (ROOT_ADMIN_USERNAME and ROOT_ADMIN_PASSWORD_HASH):
            return

        by_username = await db_manager.get_account_by_username(ROOT_ADMIN_USERNAME)
        by_id = await db_manager.get_account_by_id(0)

        # If there is a conflict, log error and exit
        if by_id and by_id.get("username") != ROOT_ADMIN_USERNAME:
            logging.error(
                f"Fatal: Account with id=0 exists but username is '{by_id.get('username')}', expected '{ROOT_ADMIN_USERNAME}'. Please resolve manually."
            )
            sys.exit(1)
        if by_username and by_username.get("id") != 0:
            logging.error(
                f"Fatal: Account with username='{ROOT_ADMIN_USERNAME}' exists but id is {by_username.get('id')}, expected 0. Please resolve manually."
            )
            sys.exit(1)

        # If neither exists, create the correct one
        if not by_id and not by_username:
            await db_manager.create_account(
                username=ROOT_ADMIN_USERNAME,
                password_hash=ROOT_ADMIN_PASSWORD_HASH,
                role="root_admin",
                self_description="Root admin account",
                id=0,
            )
            return

        # If the correct one exists, update fields as needed
        account = by_id or by_username
        if account:
            updates = {}
            if account.get("password_hash") != ROOT_ADMIN_PASSWORD_HASH:
                logging.warning(
                    "Root admin password hash in DB differs from ADMIN_PASSWORD_HASH env var. Updating password hash for root admin!"
                )
                updates["password_hash"] = ROOT_ADMIN_PASSWORD_HASH
            if updates:
                await db_manager.update_account(0, **updates)

    return _ensure


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db_manager.connect()
    db_manager.create_tables()
    await ensure_root_admin_account()()
    yield
    await db_manager.disconnect()


app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(game_router)
app.include_router(admin_router)

# Serve static files at /static (only if not in development mode)
if not DEVELOPMENT_MODE:
    app.mount("/static", StaticFiles(directory="static", html=True), name="static")


# Serve the SPA for all non-API routes
@app.get("/{path:path}")
async def serve_spa(request: Request, path: str):
    """Serve the Single Page Application for all non-API routes."""
    # Check if the request is for an API endpoint
    if any(path.startswith(endpoint) for endpoint in API_ENDPOINTS):
        # This shouldn't happen if routing is correct, but just in case
        return JSONResponse({"error": "Not found"}, status_code=404)

    # Check if the request is for a static file (should be handled by StaticFiles mount)
    if any(path.endswith(ext) for ext in STATIC_FILE_EXTENSIONS):
        # In production, these should be served from /static/ path
        # If someone is requesting them from root, return 404
        return JSONResponse({"error": "Not found"}, status_code=404)

    # In development mode, redirect to frontend dev server
    if DEVELOPMENT_MODE:
        redirect_url = f"{FRONTEND_DEV_URL}/{path}" if path else FRONTEND_DEV_URL
        return RedirectResponse(url=redirect_url, status_code=302)

    # Serve the SPA
    return FileResponse("static/index.html")
