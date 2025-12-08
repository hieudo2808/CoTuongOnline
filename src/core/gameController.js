// Main game controller - handles game logic and events

import { Board } from "./board.js";
import { Record } from "../models/record.js";
import { UI } from "../ui/renderer.js";
import { MoveNotation } from "../utils/moveNotation.js";

export class GameController {
    constructor(initialPositionOrContainerId, initialPosition = null) {
        this.chessboard = new Board();
        this.eventListeners = new Map(); // Simple event system
        this.stack = []; // Move history
        this.ui = null;
        
        // Handle both legacy and modern constructor signatures
        // Legacy: new GameController(initialPosition)
        // Modern: new GameController(containerId, initialPosition) or new GameController(containerId)
        // Lazy: new GameController(null) - no UI, just board logic
        let boardContainerId = null;
        
        if (typeof initialPositionOrContainerId === 'string') {
            // Modern mode: first arg is container ID
            boardContainerId = initialPositionOrContainerId;
            this.initialPosition = initialPosition;
        } else if (Array.isArray(initialPositionOrContainerId)) {
            // Legacy mode: first arg is initial position (array)
            this.initialPosition = initialPositionOrContainerId;
        } else {
            // Null or undefined - lazy mode, no UI yet
            this.initialPosition = initialPosition;
        }
        
        // Store for later initialization
        this.boardContainerId = boardContainerId;

        // Bind methods to this context
        this.boundChoosePiece = (e) => this.choosePiece(e);
        this.boundCancelPiece = (e) => this.cancelPiece(e);

        // Initialize board data
        this.chessboard.initBoard(this.initialPosition);
        
        // Only initialize UI if container ID is provided and exists
        if (boardContainerId) {
            try {
                this.ui = new UI(boardContainerId);
                this.ui.renderBoard(this.chessboard.board);
                this.bindEvents();
                this.initListeners();
            } catch (error) {
                console.error("[GameController] Failed to initialize UI:", error.message);
                // Continue without UI - can be initialized later
                this.ui = null;
            }
        }
    }
    
    /**
     * Initialize or reinitialize UI with a container
     */
    initUI(boardContainerId) {
        // Check if UI is already properly initialized
        if (this.ui && this.ui.isInitialized) {
            console.log("[GameController] UI already initialized");
            return true;
        }
        
        try {
            this.boardContainerId = boardContainerId;
            
            // If UI exists but not initialized (lazy mode), use initialize()
            if (this.ui && !this.ui.isInitialized) {
                this.ui.initialize(boardContainerId);
            } else {
                // Create new UI instance
                this.ui = new UI(boardContainerId);
            }
            
            this.ui.renderBoard(this.chessboard.board);
            this.bindEvents();
            this.initListeners();
            console.log("[GameController] UI initialized successfully");
            return true;
        } catch (error) {
            console.error("[GameController] Failed to initialize UI:", error.message);
            return false;
        }
    }

    /**
     * Reset the game to the initial position (keeps the same controller instance)
     */
    reset() {
        // Clear move history
        this.stack = [];

        // Reinitialize board pieces
        if (this.initialPosition) {
            this.chessboard.initBoard(this.initialPosition);
        } else {
            // If no initial position saved, clear the board
            this.chessboard.initBoard([]);
        }

        // Reset chessboard state
        this.chessboard.turn = 'red';
        this.chessboard.status = true;
        this.chessboard.curPiece = null;
        this.chessboard.turnCnt = 0;

        // Clear and re-render UI
        if (this.ui && typeof this.ui.clearBoard === 'function') {
            this.ui.clearBoard();
            this.ui.renderBoard(this.chessboard.board);
        }

        // Re-bind listeners for the new board state
        this.initListeners();
    }

    bindEvents() {
        // 1. Gán sự kiện cho các nút bấm (New Game, Resign, Draw)
        if (this.ui.buttons.newGame) {
            this.ui.buttons.newGame.addEventListener("click", () => this.handleNewGame());
        }
        if (this.ui.buttons.resign) {
            this.ui.buttons.resign.addEventListener("click", () => this.handleResign());
        }

        // 2. Gán sự kiện Click cho Bàn cờ (Sử dụng Event Delegation)
        const boardContainer = document.getElementById(this.boardContainerId);
        
        if (boardContainer) {
            // Xóa listener cũ (nếu cần thiết, hoặc cloneNode để clear)
            // Ở đây ta gán trực tiếp, giả định bindEvents chỉ chạy 1 lần khi init
            boardContainer.addEventListener('click', (e) => {
                // Tìm element mục tiêu là ô lưới (.piece-spot) hoặc quân cờ (.pieces)
                // closest() giúp tìm phần tử cha gần nhất khớp selector
                const target = e.target.closest('.piece-spot') || e.target.closest('.pieces');
                
                if (target) {
                    // Nếu click vào quân cờ (.pieces), ta cần lấy phần tử cha của nó (.piece-spot) 
                    // để lấy tọa độ data-x, data-y
                    const spot = target.classList.contains('pieces') ? target.parentElement : target;
                    
                    // Kiểm tra xem có đúng là ô cờ có tọa độ không
                    if (spot && spot.hasAttribute('data-x')) {
                        // Giả lập một event object để truyền vào hàm cũ handleBoardClick
                        // sao cho logic cũ vẫn hoạt động mà không cần sửa nhiều
                        this.handleBoardClick({
                            target: e.target,       // Element thực sự bị click
                            currentTarget: spot,    // Element chứa tọa độ (giả lập currentTarget)
                            stopPropagation: () => e.stopPropagation()
                        });
                    }
                }
            });
        } else {
            console.warn("[GameController] Board container not found to bind events");
        }
    }

    handleNewGame() {
        location.reload();
    }

    handleResign() {
        this.chessboard.status = false;
    }

    handleBoardClick(event) {
        // Kiểm tra trạng thái game
        if (!this.chessboard.status) {
            if (event.stopPropagation) event.stopPropagation();
            return;
        }

        // Lấy tọa độ từ currentTarget (đã được bindEvents truyền vào là div.piece-spot)
        const cell = event.currentTarget;
        const x = parseInt(cell.getAttribute("data-x"));
        const y = parseInt(cell.getAttribute("data-y"));

        // Logic chọn quân (Select)
        if (!this.chessboard.curPiece) {
            // Nếu chưa chọn quân, tìm quân tại vị trí click để chọn
            const piece = this.chessboard.board[x][y];
            if (piece && piece.color === this.chessboard.turn) {
                this.chessboard.curPiece = piece;
                this.ui.renderBoard(this.chessboard.board); // Re-render để hiện highlight (nếu có logic highlight)
                
                // Highlight thủ công (nếu renderer không tự làm)
                const pieceDiv = cell.querySelector('.pieces');
                if (pieceDiv) pieceDiv.classList.add('selected');
            }
        } 
        // Logic đi quân (Move)
        else {
            // Đã chọn quân, thực hiện di chuyển
            // Nếu click lại vào chính quân đó -> Hủy chọn
            if (this.chessboard.curPiece.row === x && this.chessboard.curPiece.col === y) {
                this.chessboard.curPiece = null;
                this.ui.renderBoard(this.chessboard.board); // Bỏ highlight
                return;
            }

            // Thử di chuyển
            const res = this.chessboard.movePiece(this.chessboard.curPiece, x, y);
            if (res) {
                this.executeMove(x, y); // Thực hiện nước đi
            } else {
                // Nước đi không hợp lệ
                // Nếu click vào quân khác cùng màu -> Đổi quân chọn
                const targetPiece = this.chessboard.board[x][y];
                if (targetPiece && targetPiece.color === this.chessboard.turn) {
                    this.chessboard.curPiece = targetPiece;
                    this.ui.renderBoard(this.chessboard.board);
                    const pieceDiv = cell.querySelector('.pieces');
                    if (pieceDiv) pieceDiv.classList.add('selected');
                }
            }
        }
        
        if (event.stopPropagation) event.stopPropagation();
    }

    executeMove(newRow, newCol) {
        const curRow = this.chessboard.curPiece.row;
        const curCol = this.chessboard.curPiece.col;

        // Store move info for event
        const moveInfo = {
            from: { row: curRow, col: curCol },
            to: { row: newRow, col: newCol },
            piece: this.chessboard.curPiece,
            color: this.chessboard.turn
        };

        // Update board state
        this.chessboard.board[curRow][curCol] = null;
        this.chessboard.board[newRow][newCol] = this.chessboard.curPiece;

        // Update DOM
        const source = document.querySelector(
            `[data-x="${curRow}"][data-y="${curCol}"]`
        );
        const target = document.querySelector(
            `[data-x="${newRow}"][data-y="${newCol}"]`
        );
        const clickedPiece = source.querySelector("div");
        const targetPiece = target.children[0];

        source.removeChild(clickedPiece);
        if (targetPiece) {
            target.removeChild(targetPiece);
            moveInfo.captured = true;
        }
        target.appendChild(clickedPiece);
        clickedPiece.style.backgroundColor = "#FAF0E6";

        // Switch turn
        this.switchTurn();

        // Update piece position
        this.chessboard.curPiece.row = newRow;
        this.chessboard.curPiece.col = newCol;
        this.chessboard.curPiece = null;

        // Check for check/checkmate
        this.checkGameStatus();

        // Update event listeners
        this.initListeners();

        // Emit move-made event
        this.emit('move-made', moveInfo);

        if (this.onMoveMade) {
            this.onMoveMade(moveInfo);
        }
        
        return true;
    }

    switchTurn() {
        this.chessboard.turn = this.chessboard.turn === "red" ? "black" : "red";
        if (this.ui && this.ui.updateTurn) {
            this.ui.updateTurn(this.chessboard.turn);
        }
    }

    checkGameStatus() {
        const checkRed = this.chessboard.isCheck("red", this.chessboard.board);
        const checkBlack = this.chessboard.isCheck(
            "black",
            this.chessboard.board
        );

        // Skip UI updates if no UI
        if (!this.ui) return;

        if (checkRed || checkBlack) {
            const isCheckmate = this.chessboard.isCheckMate(
                this.chessboard.turn,
                this.chessboard.board
            );

            if (isCheckmate) {
                this.chessboard.status = false;
            }
        }
    }

    choosePiece(event) {
        if (!this.chessboard.status) {
            event.stopPropagation();
            return;
        }

        const clickedPiece = event.target;
        if (this.chessboard.turn !== clickedPiece.getAttribute("data-color")) {
            return;
        }

        if (clickedPiece.classList.contains("pieces")) {
            const x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
            const y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
            this.chessboard.curPiece = this.chessboard.board[x][y];
        }

        if (
            this.chessboard.turn === clickedPiece.getAttribute("data-color") &&
            this.chessboard.curPiece
        ) {
            clickedPiece.style.backgroundColor = "#B0E0E6";
            event.stopPropagation();
        }

        this.initListeners();
    }

    cancelPiece(event) {
        const clickedPiece = event.target;
        let selectedPiece = null;

        if (clickedPiece) {
            const x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
            const y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
            selectedPiece = this.chessboard.board[x][y];
        }

        if (
            this.chessboard.status &&
            this.chessboard.curPiece &&
            this.chessboard.curPiece === selectedPiece
        ) {
            clickedPiece.style.backgroundColor = "#FAF0E6";
            this.chessboard.curPiece = null;
        }

        this.initListeners();
    }

    initListeners() {
        const pieces = document.getElementsByClassName("pieces");
        for (let i = 0; i < pieces.length; i++) {
            // Remove old listeners
            pieces[i].removeEventListener("click", this.boundChoosePiece);
            pieces[i].removeEventListener("click", this.boundCancelPiece);

            // Add new listeners based on game state
            if (!this.chessboard.curPiece) {
                pieces[i].addEventListener(
                    "click",
                    this.boundChoosePiece,
                    false
                );
            } else {
                pieces[i].addEventListener(
                    "click",
                    this.boundCancelPiece,
                    false
                );
            }
        }
    }

    // ========== Event System ==========
    
    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, ...args) {
        if (!this.eventListeners.has(event)) return;
        this.eventListeners.get(event).forEach(callback => {
            try {
                callback(...args);
            } catch (e) {
                console.error(`Error in event handler for ${event}:`, e);
            }
        });
    }

    // ========== Board Setup ==========

    /**
     * Setup board for a new game (alias for reset with UI initialization)
     */
    setupBoard(options = {}) {
        const { flipped = false } = options;
        this.isFlipped = flipped;
        
        // Reset game state
        this.reset();
        
        // Apply flip if needed
        if (flipped && this.ui) {
            this.flipBoard();
        }
        
        return true;
    }

    /**
     * Flip the board view (for black player)
     */
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        const container = document.getElementById(this.boardContainerId);
        if (container) {
            if (this.isFlipped) {
                container.classList.add('flipped');
            } else {
                container.classList.remove('flipped');
            }
        }
    }

    // ========== Move Validation ==========

    /**
     * Validate if a move is legal
     */
    validateMove(from, to) {
        if (!this.chessboard || !this.chessboard.board) {
            return false;
        }

        const piece = this.chessboard.board[from.row][from.col];
        if (!piece) {
            return false;
        }

        // Check if it's the right turn
        if (piece.color !== this.chessboard.turn) {
            return false;
        }

        // Use piece's canMove method if available
        if (typeof piece.canMove === 'function') {
            return piece.canMove(to.row, to.col, this.chessboard.board);
        }

        // Fallback: allow all moves (validation in movePiece)
        return true;
    }
}
