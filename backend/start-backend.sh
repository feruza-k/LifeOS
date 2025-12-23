#!/bin/bash

# Simple Backend Startup Script

cd "$(dirname "$0")"

echo "🚀 Starting LifeOS Backend..."
echo ""

# Check if dependencies are installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -q -r requirements.txt
    echo "✅ Dependencies installed"
    echo ""
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found."
    echo "Creating .env file (add your OPENAI_API_KEY)..."
    echo "OPENAI_API_KEY=your-api-key-here" > .env
    echo ""
fi

# Get IP address for mobile access
IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo "✅ Starting server..."
echo "📍 Local: http://localhost:8000"
echo "📍 Network: http://${IP}:8000"
echo "📱 Update mobile/src/constants/config.ts with IP: ${IP}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Use the Python from the current environment to ensure correct interpreter
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
