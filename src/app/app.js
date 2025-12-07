/**
 * APP.JS - Main Application Controller
 * Manages all screens, navigation, and game flow
 */

import NetworkGameController from "../core/networkGameController.js";
import { GameController } from "../core/gameController.js";
import {
    Validators,
    sanitizeHTML,
    sanitizeForDisplay,
    validateChatMessage,
    debounce,
    throttle,
} from "../utils/validators.js";
import {
    errorHandler,
    NetworkError,
    ValidationError,
    AuthenticationError,
    GameError,
} from "../utils/errorHandler.js";
import { config } from "../utils/config.js";

class XiangqiApp {
    constructor() {
        this.currentScreen = "screen-auth";
        this.gameController = null;
        this.replayController = null;
        this.network = null;
        this.userData = null;
        this.currentMatch = null;

        this.init();
    }

    init() {
        console.log("🎮 Initializing Xiangqi App...");
        this.setupEventListeners();
        this.showScreen("screen-auth");
    }

    // ===== SCREEN MANAGEMENT =====
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll(".screen").forEach((screen) => {
            screen.classList.remove("active");
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add("active");
            this.currentScreen = screenId;
            console.log(`📺 Showing screen: ${screenId}`);
        }
    }

    // ===== STATUS MESSAGES =====
    showStatus(elementId, message, type = "info") {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = `status-message ${type}`;
            element.style.display = "block";

            // Auto hide after 5 seconds
            setTimeout(() => {
                element.style.display = "none";
            }, 5000);
        }
    }

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Connection
        document
            .getElementById("btn-connect")
            .addEventListener("click", () => this.handleConnect());

        // Tab switching
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => this.handleTabSwitch(e));
        });

        // Auth
        document
            .getElementById("btn-login")
            .addEventListener("click", () => this.handleLogin());
        document
            .getElementById("btn-register")
            .addEventListener("click", () => this.handleRegister());
        document
            .getElementById("btn-logout")
            .addEventListener("click", () => this.handleLogout());

        // Lobby menu
        document.querySelectorAll(".menu-btn").forEach((btn) => {
            btn.addEventListener("click", (e) =>
                this.handleMenuAction(e.target.dataset.action)
            );
        });

        // Room
        document
            .getElementById("btn-leave-room")
            .addEventListener("click", () => this.handleLeaveRoom());
        document
            .getElementById("btn-ready-toggle")
            .addEventListener("click", () => this.handleReadyToggle());
        document
            .getElementById("btn-send-chat")
            .addEventListener("click", () => this.handleSendRoomChat());

        // Game
        document
            .getElementById("btn-resign")
            .addEventListener("click", () => this.handleResign());
        document
            .getElementById("btn-draw-offer")
            .addEventListener("click", () => this.handleDrawOffer());
        document
            .getElementById("btn-leave-game")
            .addEventListener("click", () => this.handleLeaveGame());
        document
            .getElementById("btn-game-chat-send")
            .addEventListener("click", () => this.handleSendGameChat());

        // Leaderboard
        document
            .getElementById("btn-back-to-lobby")
            .addEventListener("click", () => this.showScreen("screen-lobby"));

        // History
        document
            .getElementById("btn-history-back")
            .addEventListener("click", () => this.showScreen("screen-lobby"));

        // Replay
        document
            .getElementById("btn-close-replay")
            .addEventListener("click", () => this.handleCloseReplay());
        document
            .getElementById("btn-replay-first")
            .addEventListener("click", () => this.handleReplayControl("first"));
        document
            .getElementById("btn-replay-prev")
            .addEventListener("click", () => this.handleReplayControl("prev"));
        document
            .getElementById("btn-replay-play")
            .addEventListener("click", () => this.handleReplayControl("play"));
        document
            .getElementById("btn-replay-next")
            .addEventListener("click", () => this.handleReplayControl("next"));
        document
            .getElementById("btn-replay-last")
            .addEventListener("click", () => this.handleReplayControl("last"));

        // Settings
        document
            .getElementById("btn-settings")
            .addEventListener("click", () =>
                this.showScreen("screen-settings")
            );
        document
            .getElementById("btn-close-settings")
            .addEventListener("click", () =>
                this.showScreen(
                    this.currentScreen === "screen-settings"
                        ? "screen-lobby"
                        : this.currentScreen
                )
            );

        // Modals
        document
            .getElementById("btn-draw-accept")
            .addEventListener("click", () => this.handleDrawResponse(true));
        document
            .getElementById("btn-draw-decline")
            .addEventListener("click", () => this.handleDrawResponse(false));
        document
            .getElementById("btn-challenge-accept")
            .addEventListener("click", () =>
                this.handleChallengeResponse(true)
            );
        document
            .getElementById("btn-challenge-decline")
            .addEventListener("click", () =>
                this.handleChallengeResponse(false)
            );

        // Result modal
        document
            .getElementById("btn-result-replay")
            .addEventListener("click", () => this.handleResultReplay());
        document
            .getElementById("btn-result-rematch")
            .addEventListener("click", () => this.handleRematch());
        document
            .getElementById("btn-result-lobby")
            .addEventListener("click", () => this.handleResultToLobby());
    }

    handleTabSwitch(e) {
        const tabName = e.target.dataset.tab;

        // Update tab buttons
        e.target.parentElement.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.classList.remove("active");
        });
        e.target.classList.add("active");

        // Update tab content
        const parent = e.target.closest(".auth-box, .leaderboard-container");
        parent.querySelectorAll(".tab-content").forEach((content) => {
            content.classList.remove("active");
        });
        parent.querySelector(`#tab-${tabName}`).classList.add("active");
    }

    // ===== CONNECTION =====
    async handleConnect() {
        const host = document.getElementById("server-host").value.trim();
        const port = document.getElementById("server-port").value.trim();

        // Validate inputs
        const hostValidation = Validators.host(host);
        if (!hostValidation.valid) {
            this.showStatus("connection-status", hostValidation.error, "error");
            return;
        }

        const portValidation = Validators.port(port);
        if (!portValidation.valid) {
            this.showStatus("connection-status", portValidation.error, "error");
            return;
        }

        this.showStatus("connection-status", "Đang kết nối...", "info");

        try {
            // Store connection info for later use
            this.serverHost = host;
            this.serverPort = port;
            
            // Create game controller WITHOUT board (lazy initialization)
            // Pass null to skip UI creation until we enter game screen
            this.gameController = new NetworkGameController(null);

            // Setup callbacks
            this.setupGameCallbacks();

            // Connect with timeout
            await Promise.race([
                this.gameController.connectToServer(host, port),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new NetworkError("Connection timeout")),
                        config.get("API_TIMEOUT")
                    )
                ),
            ]);

            this.showStatus(
                "connection-status",
                "✅ Kết nối thành công!",
                "success"
            );

            // Show auth forms
            document.getElementById("auth-forms").style.display = "block";
            document.getElementById("btn-connect").disabled = true;
        } catch (error) {
            console.error("Connection error:", error);
            errorHandler.handleError(error, { context: "connect", host, port });
            this.showStatus(
                "connection-status",
                `❌ Lỗi kết nối: ${error.message}`,
                "error"
            );
        }
    }

    setupGameCallbacks() {
        // Match found
        this.gameController.onMatchFound = (payload) => {
            this.currentMatch = payload;
            this.showGameScreen(payload);
        };

        // Opponent move
        this.gameController.onOpponentMove = (move) => {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
        };

        // Game end
        this.gameController.onGameEnd = (result) => {
            this.showGameResult(result);
        };

        // Draw offer
        this.gameController.onDrawOffer = () => {
            this.showModal("modal-draw");
        };

        // Challenge received
        this.gameController.onChallengeReceived = (challenger) => {
            document.getElementById("challenge-from").textContent =
                challenger.username;
            this.showModal("modal-challenge");
        };

        // Connection error
        this.gameController.onConnectionError = (error) => {
            console.error("Network error:", error);
            alert(`Mất kết nối: ${error.message}`);
            this.handleLogout();
        };

        // Chat message
        this.gameController.onChatMessage = (payload) => {
            this.handleChatMessageReceived(payload);
        };
    }

    // ===== AUTHENTICATION =====
    async handleLogin() {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        // Validate inputs
        const usernameValidation = Validators.username(username);
        if (!usernameValidation.valid) {
            this.showStatus("auth-status", usernameValidation.error, "error");
            return;
        }

        if (!password) {
            this.showStatus("auth-status", "Vui lòng nhập mật khẩu", "error");
            return;
        }

        this.showStatus("auth-status", "Đang đăng nhập...", "info");

        try {
            await this.gameController.login(username, password);

            this.userData = {
                username,
                userId: this.gameController.userId,
                token: this.gameController.token,
            };

            this.showStatus(
                "auth-status",
                `✅ Đăng nhập thành công! Xin chào ${sanitizeHTML(username)}`,
                "success"
            );

            // Update header with sanitized username
            document.getElementById(
                "username-display"
            ).textContent = `👤 ${sanitizeHTML(username)}`;
            document.getElementById("user-info").style.display = "flex";
            document.getElementById("btn-logout").style.display = "block";

            // Load rating
            await this.loadUserRating();

            // Go to lobby
            setTimeout(() => {
                this.showScreen("screen-lobby");
                this.loadLobbyData();
            }, 1000);
        } catch (error) {
            console.error("Login error:", error);
            this.showStatus(
                "auth-status",
                `❌ Đăng nhập thất bại: ${error.message}`,
                "error"
            );
        }
    }

    async handleRegister() {
        const username = document
            .getElementById("register-username")
            .value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;
        const confirm = document.getElementById("register-confirm").value;

        // Validate username
        const usernameValidation = Validators.username(username);
        if (!usernameValidation.valid) {
            this.showStatus("auth-status", usernameValidation.error, "error");
            return;
        }

        // Validate email
        const emailValidation = Validators.email(email);
        if (!emailValidation.valid) {
            this.showStatus("auth-status", emailValidation.error, "error");
            return;
        }

        // Validate password
        const passwordValidation = Validators.password(password);
        if (!passwordValidation.valid) {
            this.showStatus("auth-status", passwordValidation.error, "error");
            return;
        }

        // Check password confirmation
        if (password !== confirm) {
            this.showStatus("auth-status", "Mật khẩu không khớp", "error");
            return;
        }

        this.showStatus("auth-status", "Đang đăng ký...", "info");

        try {
            await this.gameController.register(username, email, password);

            this.showStatus(
                "auth-status",
                "✅ Đăng ký thành công! Vui lòng đăng nhập.",
                "success"
            );

            // Switch to login tab
            document.querySelector('.tab-btn[data-tab="login"]').click();

            // Pre-fill username
            document.getElementById("login-username").value = username;

            // Clear registration form
            document.getElementById("register-username").value = "";
            document.getElementById("register-email").value = "";
            document.getElementById("register-password").value = "";
            document.getElementById("register-confirm").value = "";
        } catch (error) {
            console.error("Register error:", error);
            errorHandler.handleError(error, {
                context: "register",
                username,
                email,
            });
            this.showStatus(
                "auth-status",
                `❌ Đăng ký thất bại: ${error.message}`,
                "error"
            );
        }
    }

    handleLogout() {
        if (this.gameController) {
            this.gameController.disconnect();
        }

        this.userData = null;
        this.currentMatch = null;

        // Reset UI
        document.getElementById("user-info").style.display = "none";
        document.getElementById("btn-logout").style.display = "none";
        document.getElementById("btn-connect").disabled = false;
        document.getElementById("auth-forms").style.display = "none";

        // Clear forms
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";

        this.showScreen("screen-auth");
        this.showStatus("connection-status", "Đã đăng xuất", "info");
    }

    async loadUserRating() {
        try {
            // TODO: Get user rating from server
            const rating = 1500; // Placeholder
            document.getElementById(
                "rating-display"
            ).textContent = `⭐ ${rating}`;
        } catch (error) {
            console.error("Failed to load rating:", error);
        }
    }

    // ===== LOBBY =====
    async loadLobbyData() {
        // Load online stats
        this.updateOnlineStats();

        // Load rooms list
        this.loadRoomsList();

        // Refresh every 5 seconds
        if (this.lobbyInterval) clearInterval(this.lobbyInterval);
        this.lobbyInterval = setInterval(() => {
            if (this.currentScreen === "screen-lobby") {
                this.updateOnlineStats();
                this.loadRoomsList();
            }
        }, 5000);
    }

    updateOnlineStats() {
        // TODO: Get from server
        document.getElementById("online-count").textContent = "42";
        document.getElementById("playing-count").textContent = "18";
    }

    loadRoomsList() {
        const container = document.getElementById("rooms-container");

        // TODO: Get rooms from server
        // Placeholder
        container.innerHTML = `
            <div class="room-card">
                <h4>🏠 Room #1234</h4>
                <p>Host: Player1 (1600)</p>
                <p>Mode: Ranked • Time: 10:00</p>
                <p>Players: 1/2</p>
            </div>
            <div class="room-card">
                <h4>🏠 Room #5678</h4>
                <p>Host: Player2 (1450)</p>
                <p>Mode: Normal • Time: 15:00</p>
                <p>Players: 2/2</p>
            </div>
        `;
    }

    async handleMenuAction(action) {
        console.log(`Menu action: ${action}`);

        switch (action) {
            case "quick-match":
                await this.handleQuickMatch();
                break;
            case "ranked-match":
                await this.handleRankedMatch();
                break;
            case "create-room":
                this.handleCreateRoom();
                break;
            case "join-room":
                this.handleJoinRoom();
                break;
            case "friend-challenge":
                this.handleFriendChallenge();
                break;
            case "leaderboard":
                this.showLeaderboard();
                break;
            case "history":
                this.showHistory();
                break;
            case "practice":
                this.handlePractice();
                break;
        }
    }

    async handleQuickMatch() {
        try {
            await this.gameController.setReady(true);
            await this.gameController.findMatch("random");
            // Will trigger onMatchFound callback
        } catch (error) {
            alert(`Không tìm thấy trận: ${error.message}`);
        }
    }

    async handleRankedMatch() {
        try {
            await this.gameController.setReady(true);
            await this.gameController.findMatch("rated");
        } catch (error) {
            alert(`Không tìm thấy trận xếp hạng: ${error.message}`);
        }
    }

    handleCreateRoom() {
        // TODO: Show create room dialog
        alert("Tính năng đang phát triển: Tạo phòng");
    }

    handleJoinRoom() {
        // TODO: Show join room dialog
        alert("Tính năng đang phát triển: Vào phòng");
    }

    handleFriendChallenge() {
        // TODO: Show challenge dialog
        alert("Tính năng đang phát triển: Thách đấu bạn bè");
    }

    handlePractice() {
        // Show offline game screen first
        this.showScreen("screen-game");

        // Hide network controls
        const resignBtn = document.getElementById("btn-resign");
        const drawBtn = document.getElementById("btn-draw-offer");
        if (resignBtn) resignBtn.style.display = "none";
        if (drawBtn) drawBtn.style.display = "none";

        // Create offline game controller after screen is visible
        setTimeout(() => {
            const needsInit = !this.gameController || 
                !this.gameController.ui || 
                !this.gameController.ui.isInitialized;
            
            if (needsInit) {
                this.gameController = new GameController("xiangqi-board");
            }
        }, 50);

        alert("Chế độ luyện tập offline");
    }

    // ===== ROOM =====
    handleLeaveRoom() {
        this.showScreen("screen-lobby");
    }

    handleReadyToggle() {
        const btn = document.getElementById("btn-ready-toggle");
        const isReady = btn.textContent === "Sẵn Sàng";

        if (isReady) {
            btn.textContent = "Hủy Sẵn Sàng";
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-warning");
        } else {
            btn.textContent = "Sẵn Sàng";
            btn.classList.remove("btn-warning");
            btn.classList.add("btn-primary");
        }

        // TODO: Send to server
    }

    handleSendRoomChat() {
        const input = document.getElementById("room-chat-input");
        const message = input.value.trim();

        if (!message) {
            return;
        }

        // Validate and sanitize chat message
        const validation = validateChatMessage(message);
        if (!validation.valid) {
            this.showStatus("room-status", validation.error, "error");
            return;
        }

        try {
            // TODO: Send chat to server
            this.addChatMessage(
                "room-chat-messages",
                this.userData.username,
                validation.sanitized
            );
            input.value = "";
        } catch (error) {
            errorHandler.handleError(error, { context: "room-chat", message });
        }
    }

    // ===== GAME =====
    showGameScreen(matchData) {
        this.showScreen("screen-game");
        
        // Initialize board UI now that screen is visible
        // Check if UI exists and is initialized
        const needsInitUI = this.gameController && 
            (!this.gameController.ui || !this.gameController.ui.isInitialized);
        
        if (needsInitUI) {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                this.gameController.initUI("xiangqi-board");
            }, 50);
        }

        // Update player info
        document.getElementById("opponent-name").textContent =
            matchData.opponent_name || "Đối thủ";
        document.getElementById("opponent-rating").textContent = `Rating: ${
            matchData.opponent_rating || "?"
        }`;
        document.getElementById("current-name").textContent =
            this.userData.username;
        document.getElementById("current-rating").textContent = `Rating: ${
            document.getElementById("rating-display").textContent
        }`;

        // Reset timers
        document.getElementById("opponent-timer").textContent = "10:00";
        document.getElementById("current-timer").textContent = "10:00";

        // Clear move history
        document.getElementById("moves-list").innerHTML = "";

        // Update turn
        this.updateTurnIndicator();
    }

    updateTurnIndicator() {
        const turnText = document.getElementById("turn-text");

        if (this.gameController.isMyTurn) {
            turnText.textContent = "✅ Lượt của bạn";
            turnText.style.color = "var(--success-color)";
        } else {
            turnText.textContent = "⏳ Lượt đối thủ";
            turnText.style.color = "var(--warning-color)";
        }
    }

    updateMoveHistory(move) {
        const movesList = document.getElementById("moves-list");
        const moveItem = document.createElement("div");
        moveItem.className = "move-item";
        moveItem.textContent = `${move.piece}: ${move.from} → ${move.to}`;
        movesList.appendChild(moveItem);
        movesList.scrollTop = movesList.scrollHeight;
    }

    async handleResign() {
        if (confirm("Bạn có chắc muốn đầu hàng?")) {
            await this.gameController.resign();
        }
    }

    async handleDrawOffer() {
        await this.gameController.offerDraw();
        alert("Đã gửi yêu cầu hòa");
    }

    handleLeaveGame() {
        if (confirm("Bạn có chắc muốn rời trận? (Sẽ tính là thua)")) {
            this.showScreen("screen-lobby");
        }
    }

    handleSendGameChat() {
        const input = document.getElementById("game-chat-input");
        const message = input.value.trim();

        if (!message) {
            return;
        }

        // Validate and sanitize chat message
        const validation = validateChatMessage(message);
        if (!validation.valid) {
            this.showStatus("game-status", validation.error, "error");
            return;
        }

        try {
            // Send chat to server
            this.gameController.sendChatMessage(validation.sanitized);
            input.value = "";
        } catch (error) {
            errorHandler.handleError(error, { context: "game-chat", message });
        }
    }

    handleChatMessageReceived(payload) {
        // payload: { match_id, user_id, username, message, timestamp }
        const containerId = "game-chat-messages";
        this.addChatMessage(containerId, payload.username, payload.message);
    }

    addChatMessage(containerId, username, message) {
        const container = document.getElementById(containerId);
        const msgDiv = document.createElement("div");
        msgDiv.style.marginBottom = "5px";
        // Username and message are already sanitized
        msgDiv.innerHTML = `<strong>${sanitizeHTML(
            username
        )}:</strong> ${message}`;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    // ===== GAME RESULT =====
    showGameResult(result) {
        const modal = document.getElementById("modal-result");
        const header = document.getElementById("result-header");
        const title = document.getElementById("result-title");

        // Determine result type
        let resultType = "draw";
        if (result.result === "win") {
            resultType = "win";
            title.textContent = "🏆 Chiến Thắng!";
        } else if (result.result === "loss") {
            resultType = "loss";
            title.textContent = "💔 Thua Cuộc";
        } else {
            title.textContent = "🤝 Hòa";
        }

        header.className = `result-header ${resultType}`;

        // Update stats
        document.getElementById("result-outcome").textContent =
            result.score || "1-0";
        document.getElementById("result-moves").textContent =
            result.moves || "0";
        document.getElementById("result-time").textContent =
            result.time || "10:00";
        document.getElementById("result-rating-change").textContent =
            result.rating_change || "+0";
        document.getElementById("result-new-rating").textContent =
            result.new_rating || "1500";

        this.showModal("modal-result");
    }

    handleResultReplay() {
        this.hideModal("modal-result");
        this.showReplay(this.currentMatch);
    }

    handleRematch() {
        this.hideModal("modal-result");
        // TODO: Send rematch request
        alert("Tính năng đang phát triển: Đấu lại");
    }

    handleResultToLobby() {
        this.hideModal("modal-result");
        this.showScreen("screen-lobby");
    }

    // ===== LEADERBOARD =====
    async showLeaderboard() {
        this.showScreen("screen-leaderboard");
        await this.loadLeaderboard();
    }

    async loadLeaderboard() {
        try {
            const data = await this.gameController.getLeaderboard(50, 0);

            const tbody = document.getElementById("leaderboard-body");
            tbody.innerHTML = data
                .map(
                    (player, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${player.username}</td>
                    <td><strong>${player.rating}</strong></td>
                    <td>${player.wins}</td>
                    <td>${player.losses}</td>
                    <td>${player.draws}</td>
                    <td>${this.calculateWinRate(player)}</td>
                </tr>
            `
                )
                .join("");
        } catch (error) {
            console.error("Failed to load leaderboard:", error);
        }
    }

    calculateWinRate(player) {
        const total = player.wins + player.losses + player.draws;
        if (total === 0) return "0%";
        return `${Math.round((player.wins / total) * 100)}%`;
    }

    // ===== HISTORY =====
    async showHistory() {
        this.showScreen("screen-history");
        await this.loadHistory();
    }

    async loadHistory() {
        // TODO: Load from server
        const container = document.getElementById("history-list");

        // Placeholder
        container.innerHTML = `
            <div class="history-item win">
                <div>
                    <strong>vs Player2</strong><br>
                    <small>10 phút trước • Thắng • +15 rating</small>
                </div>
                <button class="btn-primary">Xem Lại</button>
            </div>
            <div class="history-item loss">
                <div>
                    <strong>vs Player3</strong><br>
                    <small>1 giờ trước • Thua • -12 rating</small>
                </div>
                <button class="btn-primary">Xem Lại</button>
            </div>
        `;
    }

    // ===== REPLAY =====
    showReplay(matchData) {
        this.showScreen("screen-replay");

        // Setup replay controller after screen is visible
        setTimeout(() => {
            const needsInit = !this.replayController || 
                !this.replayController.ui || 
                !this.replayController.ui.isInitialized;
            
            if (needsInit) {
                this.replayController = new GameController("replay-board");
            }
        }, 50);

        // Load match data
        document.getElementById(
            "replay-title"
        ).textContent = `📹 Trận đấu #${matchData.match_id}`;
        document.getElementById("replay-red-name").textContent =
            matchData.red_player || "Player 1";
        document.getElementById("replay-black-name").textContent =
            matchData.black_player || "Player 2";
        document.getElementById("replay-result").textContent =
            matchData.result || "1-0";
    }

    handleCloseReplay() {
        this.showScreen("screen-history");
    }

    handleReplayControl(action) {
        // TODO: Implement replay controls
        console.log(`Replay control: ${action}`);
    }

    // ===== DRAW OFFER =====
    async handleDrawResponse(accept) {
        this.hideModal("modal-draw");

        if (accept) {
            // TODO: Send accept to server
            alert("Đã chấp nhận hòa");
        } else {
            alert("Đã từ chối hòa");
        }
    }

    // ===== CHALLENGE =====
    async handleChallengeResponse(accept) {
        this.hideModal("modal-challenge");

        if (accept) {
            // TODO: Accept challenge
            alert("Đã chấp nhận thách đấu");
        } else {
            alert("Đã từ chối thách đấu");
        }
    }

    // ===== MODAL HELPERS =====
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("active");
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove("active");
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    window.xiangqiApp = new XiangqiApp();
});
