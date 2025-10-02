#!/bin/bash

# Osmosmjerka Advanced Development Script
# Usage: ./start-dev-env-watch.sh
# Access: http://localhost:3210 (frontend will proxy API calls to :8085)

set -e  # Exit on any error

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=3210
BACKEND_PORT=8085

DOTENV_BACKEND_PREFIX=()

# Load environment variables for backend from .env if available
if [ -f ".env" ]; then
    if command -v dotenv &> /dev/null; then
        echo -e "${CYAN}🌱 Using .env via dotenv CLI for backend server${NC}"
        DOTENV_BACKEND_PREFIX=(dotenv -f ../.env run --)
    else
        echo -e "${YELLOW}⚠️  dotenv CLI not found, falling back to manual .env loading${NC}"
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ -z "${line//[[:space:]]/}" || ${line:0:1} == "#" ]]; then
                continue
            fi
            if [[ "$line" != *"="* ]]; then
                continue
            fi
            key="${line%%=*}"
            value="${line#*=}"
            key="${key%%[[:space:]]*}"
            key="${key##[[:space:]]*}"
            value="${value#"${value%%[![:space:]]*}"}"
            value="${value%"${value##*[![:space:]]}"}"
            value="${value%$'\r'}"
            if [[ (${value:0:1} == '"' && ${value: -1} == '"') || (${value:0:1} == "'" && ${value: -1} == "'") ]]; then
                value="${value:1:-1}"
            fi
            export "$key=$value"
        done < .env
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found, connecting to DB won't be possible!${NC}"
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}👋 Shutting down development servers...${NC}"
    
    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Kill any remaining processes on our ports
    lsof -ti:$FRONTEND_PORT | xargs -r kill -9 2>/dev/null || true
    lsof -ti:$BACKEND_PORT | xargs -r kill -9 2>/dev/null || true
    
    exit 0
}
trap cleanup SIGINT SIGTERM

# Function to start frontend dev server
start_frontend() {
    echo -e "${CYAN}⚛️  Starting Vite development server...${NC}"
    cd frontend
    
    # Set development environment
    export NODE_ENV=development
    
    # Start Vite dev server in background
    npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT > /tmp/frontend-dev.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server started successfully
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend dev server started successfully!${NC}"
        return 0
    else
        echo -e "${RED}❌ Frontend dev server failed to start:${NC}"
        cat /tmp/frontend-dev.log | tail -10
        return 1
    fi
}

# Function to watch frontend logs and restart if needed
watch_frontend() {
    echo -e "${CYAN}👁️  Monitoring frontend dev server...${NC}"
    
    # Watch for frontend server crashes and restart
    while true; do
        sleep 5
        
        # Check if frontend server is still running
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            echo -e "${YELLOW}🔄 Frontend server stopped, restarting...${NC}"
            start_frontend
        fi
    done &
    
    # Store the PID of the watcher process
    WATCH_PID=$!
}

echo -e "${PURPLE}🎮 Starting Osmosmjerka Advanced Development Environment${NC}"
echo "============================================================"

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo -e "${RED}❌ Error: pyproject.toml not found. Make sure you're running this from the project root.${NC}"
    exit 1
fi

# Check if inotify-tools is installed (for optional advanced monitoring)
if ! command -v inotifywait &> /dev/null; then
    echo -e "${YELLOW}📦 Installing inotify-tools for advanced monitoring...${NC}"
    
    # Try different package managers
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y inotify-tools
    else
        echo -e "${YELLOW}⚠️  inotify-tools not available, using basic monitoring${NC}"
    fi
fi

# Initial setup
echo -e "${BLUE}🔨 Initial setup...${NC}"

# Check and activate virtual environment
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
    python3 -m venv .venv
fi

echo -e "${PURPLE}🐍 Activating virtual environment...${NC}"
if [[ $OSTYPE == "msys" ]]; then
    source .venv/Scripts/activate
else 
    source .venv/bin/activate
fi

# Install backend dependencies
echo -e "${PURPLE}🐍 Installing backend dependencies...${NC}"
pip install -e .[dev]

# Install frontend dependencies if needed
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "${PURPLE}📦 Installing frontend dependencies...${NC}"
    npm install
fi
cd ..

# Start frontend development server
start_frontend

# Start frontend monitoring in background
watch_frontend

echo ""
echo "============================================================"
echo -e "${GREEN}🎯 Development servers starting...${NC}"
echo -e "${GREEN}📍 Frontend (Dev): http://localhost:$FRONTEND_PORT${NC}"
echo -e "${GREEN}📍 Frontend (Dev): http://workstation.local:$FRONTEND_PORT${NC}"
echo -e "${GREEN}📍 Backend API: http://localhost:$BACKEND_PORT${NC}"
echo -e "${YELLOW}💡 Access the app via the Frontend URLs (port $FRONTEND_PORT)${NC}"
echo -e "${YELLOW}💡 API calls will be proxied to Backend (port $BACKEND_PORT)${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop both servers${NC}"
echo "============================================================"
echo ""

# Start backend server
cd backend
# Ensure venv is active for uvicorn
if [[ $OSTYPE == "msys" ]]; then
    source ../.venv/Scripts/activate
else 
    source ../.venv/bin/activate
fi
export DEVELOPMENT_MODE=true  # Enable development mode for backend
export LOG_DEVELOPMENT_MODE=true  # Enable development logging mode
export LOG_LEVEL=DEBUG  # Set log level to DEBUG for development
BACKEND_CMD=(uvicorn osmosmjerka.app:app --host 0.0.0.0 --port $BACKEND_PORT --reload --reload-dir .)

if [ ${#DOTENV_BACKEND_PREFIX[@]} -gt 0 ]; then
    "${DOTENV_BACKEND_PREFIX[@]}" "${BACKEND_CMD[@]}"
else
    "${BACKEND_CMD[@]}"
fi
