#!/bin/bash
# Clear browser cache and restart servers

echo "==================================="
echo "Restarting Xiangqi Servers"
echo "==================================="

# Kill existing servers
echo "Stopping existing servers..."
pkill -f "server 8080"
pkill -f "server 9000" 
pkill -f "http.server 3000"
sleep 1

# Start C server on port 8080
echo "Starting C Server on port 8080..."
cd /home/memory/hieudo/Code/CoTuong/network/c_server/bin
./server 8080 > /tmp/xiangqi_server.log 2>&1 &
SERVER_PID=$!
sleep 1

# Check if server started
if ps -p $SERVER_PID > /dev/null; then
    echo "✓ C Server started (PID: $SERVER_PID)"
else
    echo "✗ Failed to start C Server"
    cat /tmp/xiangqi_server.log
    exit 1
fi

# Start HTTP server
echo "Starting HTTP Server on port 3000..."
cd /home/memory/hieudo/Code/CoTuong
python3 -m http.server 3000 > /tmp/xiangqi_http.log 2>&1 &
HTTP_PID=$!
sleep 1

if ps -p $HTTP_PID > /dev/null; then
    echo "✓ HTTP Server started (PID: $HTTP_PID)"
else
    echo "✗ Failed to start HTTP Server"
    exit 1
fi

echo ""
echo "==================================="
echo "Servers are running!"
echo "==================================="
echo "C Server:    Port 8080 (PID: $SERVER_PID)"
echo "HTTP Server: Port 3000 (PID: $HTTP_PID)"
echo ""
echo "Open in browser:"
echo "  http://localhost:3000/multiplayer.html"
echo ""
echo "Use Ctrl+Shift+R to force refresh and clear cache"
echo ""
echo "To stop servers:"
echo "  kill $SERVER_PID $HTTP_PID"
echo "  or run: pkill -f 'server 8080' && pkill -f 'http.server'"
echo "==================================="
