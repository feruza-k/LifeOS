#!/bin/bash

echo "🔍 Checking network configuration..."
echo ""

# Get current IP addresses
echo "📍 Your IP addresses:"
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print "  - " $2}'
echo ""

# Check if port 8000 is listening
echo "🔌 Checking if backend is listening on port 8000..."
if lsof -i :8000 2>/dev/null | grep -q LISTEN; then
    echo "✅ Backend is running on port 8000"
    echo ""
    echo "Checking what interface it's listening on:"
    lsof -i :8000 | grep LISTEN
    echo ""
    echo "⚠️  If you see '127.0.0.1' or 'localhost', the backend is only accessible locally."
    echo "   Restart it with: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
else
    echo "❌ Backend is NOT running on port 8000"
    echo "   Start it with: ./start-backend.sh"
fi

echo ""
echo "📱 To access from mobile:"
echo "   1. Make sure your phone is on the same Wi-Fi network"
echo "   2. Find your computer's IP (shown above)"
echo "   3. Update frontend/src/constants/config.ts with that IP"
echo "   4. Access http://YOUR_IP:8000/docs from mobile browser"

