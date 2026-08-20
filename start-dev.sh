#!/bin/bash
# Start backend and frontend dev servers
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill anything on our ports
lsof -ti :3001 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null
sleep 1

echo "Starting backend..."
cd "$ROOT/backend"
node src/index.js &
BACKEND_PID=$!

sleep 2

echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo " Filament Tracker running"
echo " Open: http://localhost:5173"
echo "=========================================="
echo " Backend PID : $BACKEND_PID"
echo " Frontend PID: $FRONTEND_PID"
echo ""
echo " Press Ctrl+C to stop both"

# Keep running and forward signals
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
