#!/bin/bash

echo "🛑 Stopping any existing backend processes..."
pkill -f "uvicorn app.main:app" || true
sleep 2

echo "✅ Starting fresh backend server..."
cd "$(dirname "$0")"

# Get IP address
IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "📍 Local: http://localhost:8000"
echo "📍 Network: http://${IP}:8000"
echo "📱 Mobile: http://${IP}:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

