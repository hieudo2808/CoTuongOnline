# Makefile cho Xiangqi Multiplayer Server (không tạo .o)

CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11 -D_GNU_SOURCE
LDFLAGS = -pthread -lodbc -lm
INCLUDES = -I./include

SRC_DIR = src
BIN_DIR = bin

# Source files
SRCS = $(wildcard $(SRC_DIR)/*.c)

# Target executable
TARGET = $(BIN_DIR)/server

# Default target
all: directories $(TARGET)

# Tạo thư mục
directories:
	@mkdir -p $(BIN_DIR)

# Biên dịch trực tiếp từ .c
$(TARGET):
	$(CC) $(CFLAGS) $(INCLUDES) $(SRCS) -o $@ $(LDFLAGS)
	@echo "Server built successfully: $(TARGET)"

# Clean
clean:
	rm -rf $(BIN_DIR)
	@echo "Clean complete"

# Clean và rebuild
rebuild: clean all

# Cài dependencies
install-deps:
	@echo "Installing ODBC dependencies..."
	@if command -v apt-get > /dev/null; then \
		sudo apt-get update; \
		sudo apt-get install -y build-essential unixodbc-dev; \
	else \
		echo "Please install ODBC Driver manually for Windows"; \
	fi

# Chạy server
run: $(TARGET)
	./$(TARGET) 9000

# Debug build
debug: CFLAGS += -g -DDEBUG
debug: clean all

.PHONY: all clean rebuild install-deps run debug directories
