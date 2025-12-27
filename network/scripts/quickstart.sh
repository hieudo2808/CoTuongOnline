#!/bin/bash

# ============================================
# Xiangqi Multiplayer - Quick Start Script
# ============================================

echo "╔══════════════════════════════════════════╗"
echo "║   Xiangqi Multiplayer Quick Start       ║"
echo "╔══════════════════════════════════════════╗"
echo ""

# Check OS
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "⚠️  Warning: This script is for Linux/WSL"
    echo "   If you're on Windows, use WSL2"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
echo ""

if ! command -v gcc &> /dev/null; then
    echo "Installing GCC..."
    sudo apt-get update
    sudo apt-get install -y build-essential
else
    echo "✓ GCC already installed"
fi

if ! dpkg -l | grep -q libsqlite3-dev; then
    echo "Installing SQLite3..."
    sudo apt-get install -y libsqlite3-dev
else
    echo "✓ SQLite3 already installed"
fi

echo ""

# Step 2: Build server
echo "🔨 Step 2: Building C Server..."
echo ""

cd c_server

if [ -f "Makefile" ]; then
    make clean
    make
    
    if [ -f "bin/server" ]; then
        echo "✅ Server built successfully!"
    else
        echo "❌ Server build failed"
        exit 1
    fi
else
    echo "❌ Makefile not found. Are you in the right directory?"
    exit 1
fi

cd ..
echo ""

# Step 3: Build client
echo "🔨 Step 3: Building C Client..."
echo ""

cd c_client

if [ -f "Makefile" ]; then
    make clean
    make
    
    if [ -f "bin/client" ]; then
        echo "✅ Client built successfully!"
    else
        echo "❌ Client build failed"
        exit 1
    fi
else
    echo "❌ Makefile not found"
    exit 1
fi

cd ..
echo ""

# Step 4: Setup database
echo "💾 Step 4: Setting up database..."
echo ""

cd c_server

if [ ! -f "xiangqi.db" ]; then
    if [ -f "../sql/schema.sql" ]; then
        sqlite3 xiangqi.db < ../sql/schema.sql
        echo "✅ Database initialized"
    else
        echo "⚠️  Schema not found, will be created on first run"
    fi
else
    echo "✓ Database already exists"
fi

cd ..
echo ""

# Step 5: Instructions
echo "╔══════════════════════════════════════════╗"
echo "║        🎉 Setup Complete! 🎉            ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "📝 Next steps:"
echo ""
echo "1️⃣  Start the server:"
echo "   $ cd network/c_server"
echo "   $ ./bin/server 9000"
echo ""
echo "2️⃣  In another terminal, start a client:"
echo "   $ cd network/c_client"
echo "   $ ./bin/client 127.0.0.1 9000"
echo ""
echo "3️⃣  Test with JSON messages:"
echo "   Copy this and paste into client:"
echo ""
echo '   {"type":"register","seq":1,"token":null,"payload":{"username":"player1","email":"p1@test.com","password":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}}'
echo ""
echo "4️⃣  Or use the JavaScript bridge:"
echo "   See js_bridge/networkBridge.js"
echo ""
echo "📚 Documentation:"
echo "   - Overview:      network/README.md"
echo "   - Protocol:      network/protocol.md"
echo "   - Architecture:  network/architecture.md"
echo "   - API:           network/docs/API.md"
echo "   - Deployment:    network/docs/deployment.md"
echo "   - TODO List:     network/docs/implementation_guide.md"
echo ""
echo "🔗 Quick links:"
echo "   - Test messages: see protocol.md"
echo "   - Build issues:  check README.md"
echo "   - Integration:   see implementation_guide.md"
echo ""
echo "Good luck! 🚀"
echo ""
