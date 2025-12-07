#!/bin/bash
# Run Xiangqi Server with custom database password

# Get port from argument, default to 8080
PORT=${1:-8080}

# Get database password from environment or use default
if [ -z "$DB_PASSWORD" ]; then
    echo "==================================="
    echo "No DB_PASSWORD environment variable set."
    echo "Using default password from code."
    echo ""
    echo "To use a custom password, run:"
    echo "  export DB_PASSWORD=YourPassword"
    echo "  ./run_server.sh $PORT"
    echo "==================================="
    echo ""
fi

# Run server
echo "Starting Xiangqi Server on port $PORT..."
cd bin && ./server $PORT
