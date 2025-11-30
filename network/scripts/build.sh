#!/bin/bash
# Build script for Xiangqi Multiplayer Server

set -e  # Exit on error

echo "========================================="
echo " Building Xiangqi Multiplayer System"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on Linux/WSL
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Linux/WSL${NC}"
    echo "If you're on Windows, please use WSL2 or Linux VM"
fi

# Install dependencies
echo -e "\n${YELLOW}Checking dependencies...${NC}"

if ! command -v gcc &> /dev/null; then
    echo -e "${RED}GCC not found! Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y build-essential
fi

if ! dpkg -l | grep -q libsqlite3-dev; then
    echo -e "${YELLOW}Installing SQLite3 development library...${NC}"
    sudo apt-get install -y libsqlite3-dev
fi

echo -e "${GREEN}✓ Dependencies OK${NC}"

# Build server
echo -e "\n${YELLOW}Building C Server...${NC}"
cd c_server
make clean
make
cd ..

if [ -f "c_server/bin/server" ]; then
    echo -e "${GREEN}✓ Server built successfully${NC}"
else
    echo -e "${RED}✗ Server build failed${NC}"
    exit 1
fi

# Build client
echo -e "\n${YELLOW}Building C Client...${NC}"
cd c_client
make clean
make
cd ..

if [ -f "c_client/bin/client" ]; then
    echo -e "${GREEN}✓ Client built successfully${NC}"
else
    echo -e "${RED}✗ Client build failed${NC}"
    exit 1
fi

# Setup database
echo -e "\n${YELLOW}Setting up database...${NC}"
if [ -f "sql/schema.sql" ]; then
    cd c_server
    sqlite3 xiangqi.db < ../sql/schema.sql
    cd ..
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo -e "${YELLOW}! Database schema not found, will be created on first run${NC}"
fi

echo -e "\n${GREEN}========================================="
echo " Build Complete!"
echo "=========================================${NC}"
echo ""
echo "To run server:"
echo "  cd c_server"
echo "  ./bin/server 9000"
echo ""
echo "To run client:"
echo "  cd c_client"
echo "  ./bin/client 127.0.0.1 9000"
echo ""
