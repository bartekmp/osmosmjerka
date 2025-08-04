#!/bin/bash

# Osmosmjerka Advanced Development Script
# Usage: ./dev-watch.sh
# Access: http://localhost:3000 (frontend will proxy API calls to :8085)

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
FRONTEND_PORT=3000
BACKEND_PORT=8085

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
source .venv/bin/activate

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
echo -e "${GREEN}📍 Backend API: http://localhost:$BACKEND_PORT${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop both servers${NC}"
echo "============================================================"
echo ""

# Start backend server
cd backend
source ../.venv/bin/activate  # Ensure venv is active for uvicorn
uvicorn osmosmjerka.app:app --host 0.0.0.0 --port $BACKEND_PORT --reload --reload-dir .
