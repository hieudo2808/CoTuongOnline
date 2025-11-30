/**
 * NetworkGameController.js
 * Extends GameController to add multiplayer networking capabilities
 */

import { GameController } from "./gameController.js";
import { OPENING_POSITION, parsePosition } from "./config.js";
import NetworkBridge from "../network/websocketBridge.js";

class NetworkGameController extends GameController {
    constructor(config = {}) {
        // Use opening position if not provided
        const initialPosition = config.initialPosition || parsePosition(OPENING_POSITION);
        super(initialPosition);

        // Network properties
        this.network = null;
        this.token = null;
        this.userId = null;
        this.matchId = null;
        this.myColor = null; // 'red' or 'black'
        this.isOnlineMode = false;
        this.isMyTurn = false;

        // Callbacks
        this.onMatchFound = null;
        this.onOpponentMove = null;
        this.onGameEnd = null;
        this.onConnectionError = null;
        this.onChatMessage = null;
    }

    // Initialize network connection
    async connectToServer(host, port) {
        this.network = new NetworkBridge();

        try {
            await this.network.connect(host, port);
            console.log("[NetworkGame] Connected to server");

            // Setup event listeners
            this.setupNetworkListeners();

            return true;
        } catch (error) {
            console.error("[NetworkGame] Connection failed:", error);
            if (this.onConnectionError) {
                this.onConnectionError(error);
            }
            return false;
        }
    }

    // Setup network event listeners
    setupNetworkListeners() {
        // Match found
        this.network.on("match_found", (msg) => {
            console.log("[NetworkGame] Match found:", msg.payload);
            this.handleMatchFound(msg.payload);
        });

        // Opponent move
        this.network.on("opponent_move", (msg) => {
            console.log("[NetworkGame] Opponent move:", msg.payload);
            this.handleOpponentMove(msg.payload);
        });

        // Game end
        this.network.on("game_end", (msg) => {
            console.log("[NetworkGame] Game ended:", msg.payload);
            this.handleGameEnd(msg.payload);
        });

        // Draw offer
        this.network.on("draw_offer", (msg) => {
            console.log("[NetworkGame] Draw offer received");
            this.handleDrawOffer(msg.payload);
        });

        // Ready list update
        this.network.on("ready_list_update", (msg) => {
            console.log("[NetworkGame] Ready list updated");
            this.handleReadyListUpdate(msg.payload);
        });

        // Challenge received
        this.network.on("challenge_received", (msg) => {
            console.log("[NetworkGame] Challenge received");
            this.handleChallengeReceived(msg.payload);
        });

        // Chat message
        this.network.on("chat_message", (msg) => {
            console.log("[NetworkGame] Chat message received");
            this.handleChatMessage(msg.payload);
        });
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
                rating: payload.rating
            };
        } catch (error) {
            console.error("[NetworkGame] Login failed:", error);
            throw error;
        }
    }

    // Set ready status
    async setReady(ready = true) {
        try {
            await this.network.setReady(ready);
            console.log("[NetworkGame] Ready status set:", ready);
        } catch (error) {
            console.error("[NetworkGame] Set ready failed:", error);
            throw error;
        }
    }

    // Find match
    async findMatch(mode = "random") {
        try {
            const response = await this.network.findMatch(mode);
            console.log("[NetworkGame] Find match response:", response);
            return response;
        } catch (error) {
            console.error("[NetworkGame] Find match failed:", error);
            throw error;
        }
    }

    // Handle match found
    handleMatchFound(payload) {
        this.matchId = payload.match_id;
        this.myColor = payload.your_color;
        this.isOnlineMode = true;
        this.isMyTurn = this.myColor === "red"; // Red goes first

        console.log(
            `[NetworkGame] Match started: ${this.matchId}, playing as ${this.myColor}`
        );

        // Reset board
        this.reset();

        // Callback
        if (this.onMatchFound) {
            this.onMatchFound(payload);
        }
    }

    // Override executeMove to send to server
    async executeMove(from, to) {
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

                // Execute move locally (optimistic update)
                const result = super.executeMove(from, to);

                if (result) {
                    this.isMyTurn = false; // Wait for opponent
                }

                return result;
            } catch (error) {
                console.error("[NetworkGame] Failed to send move:", error);
                return false;
            }
        } else {
            // Local mode - just execute
            return super.executeMove(from, to);
        }
    }

    // Handle opponent move
    handleOpponentMove(payload) {
        const from = { row: payload.from.row, col: payload.from.col };
        const to = { row: payload.to.row, col: payload.to.col };

        // Execute opponent's move
        super.executeMove(from, to);

        // Now it's our turn
        this.isMyTurn = true;

        // Callback
        if (this.onOpponentMove) {
            this.onOpponentMove(payload);
        }
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
        const accept = confirm("Opponent offers a draw. Accept?");
        this.network.respondToDraw(payload.match_id, accept);
    }

    // Handle game end
    handleGameEnd(payload) {
        this.isOnlineMode = false;
        this.isMyTurn = false;

        console.log("[NetworkGame] Game ended:", payload.result);

        // Callback
        if (this.onGameEnd) {
            this.onGameEnd(payload);
        }

        // Show result
        const result = payload.result;
        let message = "";

        if (result === "draw") {
            message = "Game ended in a draw";
        } else if (
            (result === "red_win" && this.myColor === "red") ||
            (result === "black_win" && this.myColor === "black")
        ) {
            message = "You won!";
        } else {
            message = "You lost!";
        }

        alert(message);
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
        const accept = confirm(
            `User ${payload.from_user_id} challenges you to a ${
                payload.rated ? "rated" : "casual"
            } game. Accept?`
        );
        this.network.respondToChallenge(payload.challenge_id, accept);
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
