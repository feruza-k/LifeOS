#!/bin/bash

# LifeOS Backend Startup Script

echo "🚀 Starting LifeOS Backend..."

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating one..."
    echo "# OpenAI API Key" > .env
    echo "OPENAI_API_KEY=your-api-key-here" >> .env
    echo ""
    echo "⚠️  Please add your OpenAI API key to .env file!"
    echo ""
fi

# Start the server
echo "✅ Starting server on http://0.0.0.0:8000"
echo "📱 Accessible from mobile at: http://$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1):8000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
