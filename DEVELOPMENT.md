# Development vs Production Setup

This project supports both development and production environments with different frontend serving strategies.

## Development Mode

**Configuration:**
- Frontend: Vite dev server on port 3000
- Backend: FastAPI on port 8085 with `DEVELOPMENT_MODE=true`
- Base path: `/` (root)

**How it works:**
1. Vite serves frontend with `base: '/'` 
2. Backend API proxied through Vite (`/api` and `/admin` → `localhost:8085`)
3. Backend redirects non-API routes to frontend dev server
4. Hot reload and fast development

**Access URLs:**
- `http://localhost:3000` - Main development URL
- `http://your-host-url:3000` - Network access

**Start development:**
```bash
./start-dev-env-watch.sh
```

## Production Mode

**Configuration:**
- Frontend: Built and served from backend `/static/` path
- Backend: FastAPI on port 8085 with `DEVELOPMENT_MODE=false` (default)
- Base path: `/static/`

**How it works:**
1. Frontend built with `base: '/static/'`
2. Build copied to `backend/static/`
3. Backend serves static files from `/static/`
4. Backend serves SPA for non-API routes

**Build for production:**
```bash
cd frontend
NODE_ENV=production npm run build
cp -r build/* ../backend/static/
```

**Docker production:**
- Dockerfile handles the build and copy automatically
- Frontend build → `/app/backend/static`

## Key Files

- `frontend/vite.config.mjs` - Base path configuration
- `backend/osmosmjerka/app.py` - Development mode detection
- `start-dev-env-watch.sh` - Development startup script

## Environment Variables

- `NODE_ENV=production` - Triggers `/static/` base path in Vite
- `DEVELOPMENT_MODE=true` - Backend development mode (redirects to frontend dev server)

## Troubleshooting

**MIME type errors:**
- Ensure you're accessing `localhost:3000` in development, not `localhost:8085`
- Check that `DEVELOPMENT_MODE=true` is set for backend in development

**Static files not loading:**
- In production: Verify build copied to `backend/static/`
- In development: Check Vite dev server is running on port 3000

**Module loading errors (blank page):**
- App shows error page instead of blank screen for failed module imports
- Common causes: Network issues, server downtime, corrupted build files
- Solution: Reload page or rebuild frontend with correct base path
- Check browser console for specific error details

**Error boundary features:**
- Catches module loading failures and JavaScript errors
- Shows user-friendly error page with reload/retry options
- Displays technical details in development mode
- Supports multiple languages (EN/HR/PL)
