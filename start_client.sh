#!/bin/bash
# Start HTTP server for Xiangqi client

PORT=${1:-3000}

echo "======================================"
echo "Xiangqi Client HTTP Server"
echo "======================================"
echo "Starting HTTP server on port $PORT..."
echo ""
echo "Open in browser:"
echo "  http://localhost:$PORT/multiplayer.html"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"
echo ""

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
else
    echo "Error: Python not found. Please install Python to run HTTP server."
    exit 1
fi
