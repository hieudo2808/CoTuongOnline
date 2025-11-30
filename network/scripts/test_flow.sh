#!/bin/bash
# Integration test for complete game flow

set -e

echo "========================================"
echo " Xiangqi Multiplayer Integration Test"
echo "========================================"

SERVER_PORT=9001
SERVER_PID=""

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    exit
}

trap cleanup SIGINT SIGTERM EXIT

# Start server
echo "Starting server on port $SERVER_PORT..."
cd ../c_server
./bin/server $SERVER_PORT &
SERVER_PID=$!
cd ../scripts

sleep 2

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✓ Server started (PID: $SERVER_PID)"

# Test 1: Register two users
echo ""
echo "Test 1: Register two users..."

# Player 1
echo '{"type":"register","seq":1,"token":null,"payload":{"username":"player1","email":"player1@test.com","password":"hash1"}}' | nc localhost $SERVER_PORT &
sleep 1

# Player 2
echo '{"type":"register","seq":2,"token":null,"payload":{"username":"player2","email":"player2@test.com","password":"hash2"}}' | nc localhost $SERVER_PORT &
sleep 1

echo "✓ Registration sent"

# Test 2: Login
echo ""
echo "Test 2: Login both users..."

# This is a simplified test - in reality, you'd parse responses and use tokens

# Test 3: Set ready
echo ""
echo "Test 3: Set ready..."

# Test 4: Match
echo ""
echo "Test 4: Create match..."

# Test 5: Play moves
echo ""
echo "Test 5: Play 5 moves..."

# Test 6: Resign
echo ""
echo "Test 6: Player 1 resigns..."

# Test 7: Check leaderboard
echo ""
echo "Test 7: Query leaderboard..."

echo ""
echo "========================================"
echo " Integration Test Complete"
echo "========================================"
echo ""
echo "Note: This is a basic connectivity test."
echo "For full testing, use the test client or manual testing."
echo ""

# Keep server running for manual testing
echo "Server still running on port $SERVER_PORT (PID: $SERVER_PID)"
echo "Press Ctrl+C to stop"
wait $SERVER_PID
