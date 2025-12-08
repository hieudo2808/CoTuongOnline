/**
 * NetworkGameController.js
 * Extends GameController to add multiplayer networking capabilities
 */

import { GameController } from "./gameController.js";
import { OPENING_POSITION, parsePosition } from "./config.js";
import NetworkBridge from "../network/websocketBridge.js";

class NetworkGameController extends GameController {
    constructor(boardContainerIdOrConfig = null) {
        // Handle both string (container ID) and object (config) arguments
        let boardContainerId = null;
        let config = {};
        
        if (typeof boardContainerIdOrConfig === 'string') {
            // Modern mode: first arg is container ID
            boardContainerId = boardContainerIdOrConfig;
        } else if (boardContainerIdOrConfig && typeof boardContainerIdOrConfig === 'object') {
            // Legacy mode: first arg is config object
            config = boardContainerIdOrConfig;
            boardContainerId = config.boardContainerId || null;
        }
        // If null, will be initialized later via initBoard()
        
        // Use opening position if not provided
        const initialPosition = config.initialPosition || parsePosition(OPENING_POSITION);
        
        // Call parent constructor with container ID and initial position
        // If boardContainerId is null, parent will skip UI initialization
        super(boardContainerId, initialPosition);

        // Network properties
        this.network = null;
        this.token = null;
        this.userId = null;
        this.matchId = null;
        this.myColor = null; // 'red' or 'black'
        this.isOnlineMode = false;
        this.isMyTurn = false;
        this.pendingBoardContainerId = boardContainerId;

        // Callbacks
        this.onMatchFound = null;
        this.onOpponentMove = null;
        this.onGameEnd = null;
        this.onConnectionError = null;
        this.onChatMessage = null;
        this.onDrawOffer = null;       // Callback khi nhận lời mời hòa
        this.onChallengeReceived = null; // Callback khi nhận thách đấu
    }
    
    /**
     * Initialize board UI (can be called later if not done in constructor)
     */
    initBoardUI(boardContainerId) {
        if (this.ui && !this.ui.isLegacyMode) return;
        const { UI } = require("../ui/renderer.js");
        this.ui = new UI(boardContainerId);
        this.ui.renderBoard(this.chessboard.board);
        this.bindEvents();
        this.initListeners();
    }

    // Initialize network connection
    async connectToServer(host, port) {
        this.network = new NetworkBridge();
        try {
            await this.network.connect(host, port);
            console.log("[NetworkGame] Connected to server");
            this.setupNetworkListeners();
            return true;
        } catch (error) {
            console.error("[NetworkGame] Connection failed:", error);
            if (this.onConnectionError) this.onConnectionError(error);
            return false;
        }
    }

    // Setup network event listeners
    setupNetworkListeners() {
        this.network.on("match_found", (msg) => this.handleMatchFound(msg.payload));
        this.network.on("opponent_move", (msg) => this.handleOpponentMove(msg.payload));
        this.network.on("game_end", (msg) => this.handleGameEnd(msg.payload));
        
        this.network.on("draw_offer", (msg) => {
            console.log("[NetworkGame] Draw offer received");
            this.handleDrawOffer(msg.payload);
        });

        this.network.on("challenge_received", (msg) => {
            console.log("[NetworkGame] Challenge received");
            this.handleChallengeReceived(msg.payload);
        });

        this.network.on("chat_message", (msg) => this.handleChatMessage(msg.payload));
        this.network.on("ready_list_update", (msg) => this.handleReadyListUpdate(msg.payload));
    }

    // Register new user
    async register(username, email, password) {
        try {
            const response = await this.network.register(
                username,
                email,
                password
            );
            console.log("[NetworkGame] Registration successful:", response);
            return {
                status: 'success',
                message: response.message || 'Registration successful'
            };
        } catch (error) {
            console.error("[NetworkGame] Registration failed:", error);
            throw error;
        }
    }

    // Login
    async login(username, password) {
        try {
            const response = await this.network.login(username, password);

            // Parse payload if it's a JSON string
            let payload = response.payload;
            if (typeof payload === 'string') {
                payload = JSON.parse(payload);
            }

            this.token = payload.token;
            this.userId = payload.user_id;

            console.log("[NetworkGame] Login successful, user:", this.userId);
            
            // Return with parsed payload
            return {
                status: 'success',
                username: payload.username,
                token: payload.token,
                rating: payload.rating,
                user_id: payload.user_id
            };
        } catch (error) {
            console.error("[NetworkGame] Login failed:", error);
            throw error;
        }
    }

    // Set ready status
    async setReady(ready = true) { return this.network.setReady(ready); }

    // Join/rejoin a match (used when reconnecting to game.html)
    // This sends a message to server so it associates this connection with user_id
    async joinMatch(matchId) {
        try {
            // Send a simple request with token to let server know who we are
            const response = await this.network.sendAndWait(
                "join_match",
                { match_id: matchId }
            );
            console.log("[NetworkGame] Joined match:", response);
            return response;
        } catch (error) {
            console.warn("[NetworkGame] Join match failed (may not be implemented on server):", error);
            // Not critical - server will associate user_id on next move
            return null;
        }
    }

    // Find match
    async findMatch(mode = "rated") {
        try {
            const response = await this.network.findMatch(mode);
            console.log("[NetworkGame] Find match response:", response);
            return response;
        } catch (error) {
            console.error("[NetworkGame] Find match failed:", error);
            throw error;
        }
    }

    handleMatchFound(payload) {
        // Parse payload nếu nó là string (đề phòng)
        let data = payload;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        this.matchId = data.match_id;
        this.myColor = data.your_color;
        this.isOnlineMode = true;
        this.isMyTurn = this.myColor === "red"; // Red đi trước

        // --- FIX LỖI SAI ELO ---
        // Server gửi về dạng: opponent: { username: "...", rating: 1200 }
        // Cần flatten ra để UI dễ dùng
        if (data.opponent && typeof data.opponent === 'object') {
            data.opponent_name = data.opponent.username;
            data.opponent_rating = data.opponent.rating;
        }
        
        console.log(`[NetworkGame] Match started: ${this.matchId}, opponent: ${data.opponent_name} (${data.opponent_rating})`);

        // Setup board
        this.setupBoard({ flipped: this.myColor === "black" });

        // Callback UI
        if (this.onMatchFound) {
            this.onMatchFound(data); // Truyền data đã chuẩn hóa
        }
    }

    // Override executeMove to send to server
    // Handles both (newRow, newCol) from parent click handler and (from, to) objects
    async executeMove(newRowOrFrom, newColOrTo) {
        let from, to;
        
        // Check if called with objects or numbers
        if (typeof newRowOrFrom === 'object' && newRowOrFrom !== null) {
            // Called with (from, to) objects
            from = newRowOrFrom;
            to = newColOrTo;
        } else {
            // Called with (newRow, newCol) from handleBoardClick
            // In this case, curPiece contains the source position
            if (!this.chessboard.curPiece) {
                console.warn("[NetworkGame] No piece selected");
                return false;
            }
            from = { row: this.chessboard.curPiece.row, col: this.chessboard.curPiece.col };
            to = { row: newRowOrFrom, col: newColOrTo };
        }

        // In online mode, only allow moves if it's our turn
        if (this.isOnlineMode && !this.isMyTurn) {
            console.warn("[NetworkGame] Not your turn!");
            return false;
        }

        // Validate move locally first
        const isValid = this.validateMove(from, to);
        if (!isValid) {
            console.warn("[NetworkGame] Invalid move");
            return false;
        }

        // In online mode, send to server
        if (this.isOnlineMode) {
            try {
                await this.network.sendMove(
                    this.matchId,
                    from.row,
                    from.col,
                    to.row,
                    to.col
                );

                // Execute move locally using parent's method (pass row, col numbers)
                const result = super.executeMove(to.row, to.col);

                if (result) {
                    this.isMyTurn = false; // Wait for opponent
                }

                return result;
            } catch (error) {
                console.error("[NetworkGame] Failed to send move:", error);
                // If "Not your turn" error, sync turn state
                if (error.message && error.message.includes("Not your turn")) {
                    console.log("[NetworkGame] Syncing turn state: not my turn");
                    this.isMyTurn = false;
                }
                return false;
            }
        } else {
            // Local mode - just execute using parent's method
            return super.executeMove(to.row, to.col);
        }
    }

    handleOpponentMove(payload) {
        console.log("[NetworkGame] Recv Move:", payload);
        
        // 1. Parse dữ liệu phẳng từ server (C server gửi from_row, to_row...)
        let fromRow, fromCol, toRow, toCol;
        
        // Xử lý cả 2 trường hợp payload (object lồng hoặc phẳng)
        if (payload.from && typeof payload.from === 'object') {
            fromRow = payload.from.row;
            fromCol = payload.from.col;
            toRow = payload.to.row;
            toCol = payload.to.col;
        } else {
            // Trường hợp Server C gửi
            fromRow = parseInt(payload.from_row);
            fromCol = parseInt(payload.from_col);
            toRow = parseInt(payload.to_row);
            toCol = parseInt(payload.to_col);
        }

        // 2. Kiểm tra quân cờ tại vị trí nguồn
        const piece = this.chessboard.board[fromRow][fromCol];
        if (!piece) {
            console.error(`Sync Error: No piece at ${fromRow},${fromCol}`);
            return;
        }

        console.log(`Executing Opponent Move: ${piece.type} (${fromRow},${fromCol}) -> (${toRow},${toCol})`);

        // 3. Hack: Set lượt đi tạm thời thành màu của quân cờ đó để cho phép di chuyển
        // Vì GameController chặn đi nếu không phải lượt
        const originalTurn = this.chessboard.turn;
        this.chessboard.turn = piece.color;
        this.chessboard.curPiece = piece; // Set quân đang chọn

        // 4. Thực hiện nước đi qua logic của GameController (sẽ update UI và Board)
        super.executeMove(toRow, toCol);

        // 5. Cập nhật trạng thái
        // Giờ là lượt của mình
        this.isMyTurn = true;
        this.ui.updateTurn(this.chessboard.turn); // Update text hiển thị
    }

    // Resign
    async resign() {
        if (!this.isOnlineMode || !this.matchId) {
            console.warn("[NetworkGame] No active match");
            return;
        }

        try {
            await this.network.resign(this.matchId);
            console.log("[NetworkGame] Resigned from match");
        } catch (error) {
            console.error("[NetworkGame] Resign failed:", error);
        }
    }

    // Offer draw
    async offerDraw() {
        if (!this.isOnlineMode || !this.matchId) {
            console.warn("[NetworkGame] No active match");
            return;
        }

        try {
            await this.network.offerDraw(this.matchId);
            console.log("[NetworkGame] Draw offered");
        } catch (error) {
            console.error("[NetworkGame] Draw offer failed:", error);
        }
    }

    // Send chat message
    async sendChatMessage(message) {
        if (!this.isOnlineMode || !this.matchId) {
            console.warn("[NetworkGame] No active match");
            return;
        }

        try {
            await this.network.sendChatMessage(this.matchId, message);
            console.log("[NetworkGame] Chat message sent");
        } catch (error) {
            console.error("[NetworkGame] Chat message failed:", error);
            throw error;
        }
    }

    // Handle draw offer
    handleDrawOffer(payload) {
        // Kiểm tra xem UI có đăng ký xử lý không
        if (this.onDrawOffer) {
            this.onDrawOffer(payload);
        } else {
            console.log("No UI handler for draw offer");
        }
    }

    // Handle game end
    handleGameEnd(payload) {
        this.isOnlineMode = false;
        this.isMyTurn = false;
        console.log("[NetworkGame] Game ended:", payload.result);
        if (this.onGameEnd) {
            this.onGameEnd(payload);
        }
    }

    // Get leaderboard
    async getLeaderboard(limit = 10, offset = 0) {
        try {
            const response = await this.network.getLeaderboard(limit, offset);
            return response.payload;
        } catch (error) {
            console.error("[NetworkGame] Get leaderboard failed:", error);
            throw error;
        }
    }

    // Get match history
    async getMatch(matchId) {
        try {
            const response = await this.network.getMatch(matchId);
            return response.payload;
        } catch (error) {
            console.error("[NetworkGame] Get match failed:", error);
            throw error;
        }
    }

    // Handle ready list update
    handleReadyListUpdate(payload) {
        console.log("[NetworkGame] Ready players:", payload);
        // UI can display this list
    }

    // Send challenge
    async sendChallenge(opponentId, rated = false) {
        try {
            await this.network.sendChallenge(opponentId, rated);
            console.log("[NetworkGame] Challenge sent to user:", opponentId);
        } catch (error) {
            console.error("[NetworkGame] Send challenge failed:", error);
        }
    }

    // Handle challenge received
    handleChallengeReceived(payload) {
        if (this.onChallengeReceived) {
            this.onChallengeReceived(payload);
        } else {
            console.log("No UI handler for challenge");
        }
    }

    // Handle chat message
    handleChatMessage(payload) {
        console.log("[NetworkGame] Chat message:", payload);

        // Callback to UI
        if (this.onChatMessage) {
            this.onChatMessage(payload);
        }
    }

    // Disconnect
    disconnect() {
        if (this.network) {
            this.network.disconnect();
            this.network = null;
        }

        this.token = null;
        this.userId = null;
        this.matchId = null;
        this.isOnlineMode = false;
    }
}

export default NetworkGameController;
