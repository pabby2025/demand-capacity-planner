#!/bin/bash
# Startup script for Capacity Planner

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "========================================="
echo "  Capacity Planner - Startup Script"
echo "========================================="

# Check for port conflicts
BACKEND_PORT=8000
if lsof -ti :$BACKEND_PORT > /dev/null 2>&1; then
    echo "WARNING: Port $BACKEND_PORT is already in use"
    echo "Trying port 8002..."
    BACKEND_PORT=8002
fi

# Update vite proxy if needed
if [ "$BACKEND_PORT" != "8000" ]; then
    sed -i '' "s|http://localhost:8000|http://localhost:$BACKEND_PORT|g" "$FRONTEND_DIR/vite.config.ts" 2>/dev/null || true
fi

echo ""
echo "Starting Backend on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
pip3 install -q fastapi uvicorn sqlalchemy pandas openpyxl pydantic python-multipart aiofiles 2>/dev/null &

python3 -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

echo ""
echo "Starting Frontend on port 5173..."
cd "$FRONTEND_DIR"
npm install --silent 2>/dev/null &
wait
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "========================================="
echo "  Application is starting up!"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:5173"
echo "  API Docs: http://localhost:$BACKEND_PORT/docs"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Wait
wait
