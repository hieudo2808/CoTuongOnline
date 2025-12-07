# 📖 Technical Documentation

> **Chi tiết kiến trúc, implementation và code của Cờ Tướng Multiplayer**

---

## 📋 Mục Lục

-   [Kiến Trúc Tổng Quan](#-kiến-trúc-tổng-quan)
-   [Server Implementation (C)](#-server-implementation-c)
-   [Client Implementation (JavaScript)](#-client-implementation-javascript)
-   [Network Protocol](#-network-protocol)
-   [Database Schema](#-database-schema)
-   [Game Logic](#-game-logic)
-   [Security](#-security)
-   [Performance](#-performance)
-   [Code Examples](#-code-examples)

---

## 🏗️ Kiến Trúc Tổng Quan

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           BROWSER                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              HTML/CSS/JavaScript Client                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐ │ │
│  │  │    UI    │  │  Game    │  │  Network Controller      │ │ │
│  │  │  Layer   │◄─┤  Logic   │◄─┤  (WebSocket Bridge)      │ │ │
│  │  └──────────┘  └──────────┘  └────────┬─────────────────┘ │ │
│  └─────────────────────────────────────────┼────────────────────┘ │
└────────────────────────────────────────────┼─────────────────────┘
                                             │
                                  WebSocket (JSON Protocol)
                                             │
┌────────────────────────────────────────────┼─────────────────────┐
│                         SERVER              ▼                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  C Server (Epoll)                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐   │ │
│  │  │ Network  │─▶│ Message  │─▶│      Handlers         │   │ │
│  │  │  Layer   │  │ Dispatch │  │ (Auth/Game/Match...)  │   │ │
│  │  └──────────┘  └──────────┘  └───────────┬───────────┘   │ │
│  │                                           │                │ │
│  │  ┌────────────────────────────────────────▼────────────┐  │ │
│  │  │              Core Services                          │  │ │
│  │  │  • Match Manager  • Session Manager                 │  │ │
│  │  │  • Rating System  • Broadcast System                │  │ │
│  │  └────────────────────────────┬─────────────────────────┘  │ │
│  └────────────────────────────────┼────────────────────────────┘ │
│                                   │                               │
│  ┌────────────────────────────────▼────────────────────────────┐ │
│  │              Database Layer (ODBC)                          │ │
│  │  • Users  • Matches  • Moves  • Sessions                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                             SQL Server
```

### Data Flow Patterns

**1. Authentication Flow:**

```
Client                          Server                      Database
  │                               │                            │
  ├─── register(user,pass) ──────▶│                            │
  │                               ├─── hash(pass) ────────────▶│
  │                               │                            │
  │                               │◄─── insert user ───────────┤
  │                               ├─── generate token ────────▶│
  │                               │                            │
  │◄─── token ────────────────────┤                            │
  │                               │                            │
```

**2. Matchmaking Flow:**

```
Client A              Server              Client B
  │                     │                     │
  ├─ find_match ───────▶│                     │
  │                     ├─ add to queue       │
  │                     │   (rating-based)    │
  │                     │                     │
  │                     │◄─ find_match ───────┤
  │                     ├─ match A & B        │
  │                     ├─ create match_id    │
  │                     │                     │
  │◄─ match_found ──────┤                     │
  │   {match_id: 42}    ├─ match_found ───────▶│
  │                     │                     │
```

**3. Move Synchronization:**

```
Client (Red)          Server              Client (Black)
  │                     │                     │
  ├─ move ─────────────▶│                     │
  │                     ├─ validate turn      │
  │                     ├─ update state       │
  │                     ├─ save to DB         │
  │                     │                     │
  │◄─ ack ──────────────┤                     │
  │                     ├─ broadcast ─────────▶│
  │                     │   {move details}    │
```

---

## 🖥️ Server Implementation (C)

### Core Components

#### 1. Server Structure

```c
// network/c_server/include/server.h

typedef struct {
    int socket_fd;              // Listening socket
    int epoll_fd;               // Epoll instance
    int max_clients;            // Max connections
    client_t* clients;          // Client array
    int client_count;           // Current clients
    pthread_mutex_t lock;       // Thread safety
} server_t;

typedef struct {
    int fd;                     // Client socket
    int user_id;                // Logged-in user ID
    char token[65];             // Session token
    time_t last_heartbeat;      // Keep-alive timestamp
    char recv_buffer[MAX_MSG];  // Receive buffer
    int recv_len;               // Buffer length
} client_t;
```

#### 2. Event Loop (Epoll)

```c
// network/c_server/src/server.c

void server_run(server_t* server) {
    struct epoll_event events[MAX_EVENTS];

    while (1) {
        // Wait for events (timeout: 1 second)
        int n = epoll_wait(server->epoll_fd, events, MAX_EVENTS, 1000);

        for (int i = 0; i < n; i++) {
            if (events[i].data.fd == server->socket_fd) {
                // New connection
                handle_new_connection(server);
            } else {
                // Client data ready
                handle_client_message(server, events[i].data.fd);
            }
        }

        // Cleanup disconnected clients
        cleanup_dead_clients(server);
    }
}
```

#### 3. Message Dispatcher

```c
// network/c_server/src/handlers.c

void dispatch_message(server_t* server, client_t* client, message_t* msg) {
    if (strcmp(msg->type, "register") == 0) {
        handle_register(server, client, msg);
    }
    else if (strcmp(msg->type, "login") == 0) {
        handle_login(server, client, msg);
    }
    else if (strcmp(msg->type, "move") == 0) {
        handle_move(server, client, msg);
    }
    else if (strcmp(msg->type, "chat_message") == 0) {
        handle_chat_message(server, client, msg);
    }
    // ... 11 more handlers
    else {
        send_error(client, msg->seq, "Unknown message type");
    }
}
```

#### 4. Match Management

```c
// network/c_server/include/match.h

typedef struct {
    int id;                     // Match ID
    int red_user_id;            // Red player
    int black_user_id;          // Black player
    char current_turn[10];      // "red" or "black"
    char state[20];             // "ongoing", "ended"
    int is_ranked;              // Ranked match flag
    time_t started_at;          // Start time
} match_t;

// Match operations
match_t* match_create(int red_id, int black_id, int is_ranked);
match_t* match_get(int match_id);
bool match_is_player_turn(match_t* match, int user_id);
void match_switch_turn(match_t* match);
void match_end(match_t* match, const char* winner, const char* reason);
```

#### 5. Database Layer

```c
// network/c_server/src/db.c

// Connection
bool db_connect(const char* conn_str);
void db_disconnect();

// User operations
bool db_create_user(const char* username, const char* password_hash,
                    const char* email, int* out_user_id);
bool db_get_user_by_username(const char* username, user_t* out_user);
bool db_update_rating(int user_id, int new_rating);
bool db_update_stats(int user_id, int wins, int losses, int draws);

// Session operations
bool db_create_session(int user_id, const char* token, time_t expires_at);
bool db_validate_token(const char* token, int* out_user_id);
bool db_delete_session(const char* token);

// Match operations
bool db_create_match(int red_id, int black_id, int is_ranked, int* out_match_id);
bool db_end_match(int match_id, const char* winner, const char* reason);
bool db_save_move(int match_id, int move_num, const char* player,
                  int from_row, int from_col, int to_row, int to_col,
                  const char* piece_type, const char* captured);

// Chat operations
bool db_get_username(int user_id, char* out_username, size_t size);
```

#### 6. Broadcasting System

```c
// network/c_server/src/broadcast.c

// Broadcast to specific client
void broadcast_to_client(server_t* server, int user_id,
                        const char* message);

// Broadcast to both players in match
void broadcast_to_match(server_t* server, match_t* match,
                       const char* message);

// Broadcast to all clients in waiting room
void broadcast_to_room(server_t* server, const char* message);

// Broadcast to all connected clients
void broadcast_to_all(server_t* server, const char* message);
```

### Handler Examples

#### Registration Handler

```c
void handle_register(server_t* server, client_t* client, message_t* msg) {
    // Extract payload
    const char* username = json_get_string(msg->payload, "username");
    const char* password = json_get_string(msg->payload, "password");
    const char* email = json_get_string(msg->payload, "email");

    // Validate input
    if (!username || !password) {
        send_error(client, msg->seq, "Missing username or password");
        return;
    }

    if (strlen(username) < 3 || strlen(username) > 20) {
        send_error(client, msg->seq, "Username must be 3-20 characters");
        return;
    }

    // Hash password
    char hash[65];
    sha256(password, hash);

    // Create user in database
    int user_id;
    if (!db_create_user(username, hash, email, &user_id)) {
        send_error(client, msg->seq, "Username already exists");
        return;
    }

    // Generate session token
    char token[65];
    generate_token(token);

    // Create session
    time_t expires = time(NULL) + SESSION_EXPIRE_SECONDS;
    if (!db_create_session(user_id, token, expires)) {
        send_error(client, msg->seq, "Failed to create session");
        return;
    }

    // Store in client
    client->user_id = user_id;
    strcpy(client->token, token);

    // Send success response
    char response[MAX_MSG];
    snprintf(response, sizeof(response),
             "{\"user_id\":%d,\"username\":\"%s\",\"token\":\"%s\",\"rating\":1200}",
             user_id, username, token);
    send_response(client, msg->seq, true, "Registration successful", response);

    printf("[Auth] User registered: %s (ID: %d)\n", username, user_id);
}
```

#### Move Handler

```c
void handle_move(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    const char* token = json_get_string(msg->payload, "token");
    int user_id;
    if (!validate_token_and_get_user(token, &user_id)) {
        send_error(client, msg->seq, "Invalid token");
        return;
    }

    // Extract move data
    int match_id = json_get_int(msg->payload, "match_id");
    int from_row = json_get_int(msg->payload, "from_row");
    int from_col = json_get_int(msg->payload, "from_col");
    int to_row = json_get_int(msg->payload, "to_row");
    int to_col = json_get_int(msg->payload, "to_col");

    // Get match
    match_t* match = match_get(match_id);
    if (!match) {
        send_error(client, msg->seq, "Match not found");
        return;
    }

    // Validate turn
    if (!match_is_player_turn(match, user_id)) {
        send_error(client, msg->seq, "Not your turn");
        return;
    }

    // Determine player color
    const char* player = (user_id == match->red_user_id) ? "red" : "black";

    // Save move to database
    const char* piece_type = json_get_string(msg->payload, "piece_type");
    const char* captured = json_get_string(msg->payload, "captured_piece");
    db_save_move(match_id, match->move_count++, player,
                 from_row, from_col, to_row, to_col,
                 piece_type, captured);

    // Switch turn
    match_switch_turn(match);

    // Send acknowledgment
    send_response(client, msg->seq, true, "Move accepted", NULL);

    // Broadcast move to both players
    char broadcast[MAX_MSG];
    snprintf(broadcast, sizeof(broadcast),
             "{\"type\":\"move\",\"payload\":{\"match_id\":%d,\"player\":\"%s\","
             "\"from_row\":%d,\"from_col\":%d,\"to_row\":%d,\"to_col\":%d,"
             "\"piece_type\":\"%s\",\"captured\":\"%s\"}}",
             match_id, player, from_row, from_col, to_row, to_col,
             piece_type, captured ? captured : "");

    broadcast_to_match(server, match, broadcast);

    printf("[Game] Move in match %d: %s (%d,%d) -> (%d,%d)\n",
           match_id, player, from_row, from_col, to_row, to_col);
}
```

#### Chat Handler

```c
void handle_chat_message(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    const char* token = json_get_string(msg->payload, "token");
    int user_id;
    if (!validate_token_and_get_user(token, &user_id)) {
        send_error(client, msg->seq, "Invalid token");
        return;
    }

    // Get message and match_id
    const char* message = json_get_string(msg->payload, "message");
    int match_id = json_get_int(msg->payload, "match_id");

    if (!message || match_id <= 0) {
        send_error(client, msg->seq, "Missing message or match_id");
        return;
    }

    // Validate message length (max 500 chars)
    if (strlen(message) > 500) {
        send_error(client, msg->seq, "Message too long (max 500 chars)");
        return;
    }

    // Get match
    match_t* match = match_get(match_id);
    if (!match) {
        send_error(client, msg->seq, "Match not found");
        return;
    }

    // Verify user is in this match
    if (match->red_user_id != user_id && match->black_user_id != user_id) {
        send_error(client, msg->seq, "Not in this match");
        return;
    }

    // Get sender username from database
    char username[64] = {0};
    if (!db_get_username(user_id, username, sizeof(username))) {
        strcpy(username, "Unknown");
    }

    // Build chat payload
    char chat_payload[1024];
    snprintf(chat_payload, sizeof(chat_payload),
             "{\"match_id\":%d,\"user_id\":%d,\"username\":\"%s\","
             "\"message\":\"%s\",\"timestamp\":%ld}",
             match_id, user_id, username, message, (long)time(NULL));

    // Build notification
    char notification[MAX_MSG];
    snprintf(notification, sizeof(notification),
             "{\"type\":\"chat_message\",\"payload\":%s}\n",
             chat_payload);

    // Broadcast to both players
    client_t* red_client = server_get_client_by_user_id(server, match->red_user_id);
    if (red_client) {
        send_to_client(server, red_client->fd, notification);
    }

    client_t* black_client = server_get_client_by_user_id(server, match->black_user_id);
    if (black_client) {
        send_to_client(server, black_client->fd, notification);
    }

    // Acknowledge to sender
    send_response(client, msg->seq, true, "Message sent", NULL);

    printf("[Chat] User %d in match %d: %s\n", user_id, match_id, message);
}
```

---

## 🌐 Client Implementation (JavaScript)

### Architecture Layers

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│         (src/app/app.js)                │
│  • Screen management                    │
│  • Event handling                       │
│  • UI updates                           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Game Controller Layer           │
│  (src/core/networkGameController.js)   │
│  • Game state management                │
│  • Network integration                  │
│  • Callbacks                            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Core Game Logic                 │
│  (src/core/game.js, board.js)          │
│  • Piece movement validation            │
│  • Check/checkmate detection            │
│  • Game rules                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Network Layer                   │
│  (src/network/websocketBridge.js)      │
│  • WebSocket connection                 │
│  • Message send/receive                 │
│  • Event emission                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Rendering Layer                 │
│  (src/ui/renderer.js)                  │
│  • Canvas drawing                       │
│  • Animations                           │
│  • Visual effects                       │
└─────────────────────────────────────────┘
```

### Core Components

#### 1. WebSocket Bridge

```javascript
// src/network/websocketBridge.js

class WebSocketBridge {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.ws = null;
        this.sessionToken = null;
        this.listeners = new Map();
        this.sequenceNumber = 0;
        this.pendingRequests = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => {
                console.log("[WebSocket] Connected");
                this.startHeartbeat();
                resolve();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error("[WebSocket] Error:", error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log("[WebSocket] Disconnected");
                this.stopHeartbeat();
                this.emit("disconnected");
            };
        });
    }

    send(type, payload) {
        const seq = ++this.sequenceNumber;
        const message = JSON.stringify({ type, seq, payload });

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(seq, { resolve, reject });
            this.ws.send(message);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(seq)) {
                    this.pendingRequests.delete(seq);
                    reject(new Error("Request timeout"));
                }
            }, 10000);
        });
    }

    handleMessage(data) {
        const msg = JSON.parse(data);

        if (msg.type === "response") {
            // Handle response to our request
            const pending = this.pendingRequests.get(msg.seq);
            if (pending) {
                this.pendingRequests.delete(msg.seq);
                if (msg.success) {
                    pending.resolve(msg);
                } else {
                    pending.reject(new Error(msg.message));
                }
            }
        } else {
            // Handle broadcast/notification
            this.emit(msg.type, msg.payload);
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach((cb) => cb(data));
    }

    // API Methods
    async login(username, password) {
        const response = await this.send("login", { username, password });
        this.sessionToken = response.data.token;
        return response.data;
    }

    async findMatch(isRanked) {
        return await this.send("find_match", {
            token: this.sessionToken,
            is_ranked: isRanked,
        });
    }

    async sendMove(
        matchId,
        fromRow,
        fromCol,
        toRow,
        toCol,
        pieceType,
        captured
    ) {
        return await this.send("move", {
            token: this.sessionToken,
            match_id: matchId,
            from_row: fromRow,
            from_col: fromCol,
            to_row: toRow,
            to_col: toCol,
            piece_type: pieceType,
            captured_piece: captured || null,
        });
    }

    async sendChatMessage(matchId, message) {
        return await this.send("chat_message", {
            token: this.sessionToken,
            match_id: matchId,
            message: message,
        });
    }
}
```

#### 2. Network Game Controller

```javascript
// src/core/networkGameController.js

class NetworkGameController {
    constructor(network) {
        this.network = network;
        this.game = new Game();
        this.matchId = null;
        this.playerColor = null;
        this.isOnlineMode = true;

        // Callbacks
        this.onMoveReceived = null;
        this.onGameEnd = null;
        this.onChatMessage = null;

        this.setupNetworkListeners();
    }

    setupNetworkListeners() {
        // Move notification
        this.network.on("move", (msg) => {
            if (msg.payload.match_id === this.matchId) {
                this.handleOpponentMove(msg.payload);
            }
        });

        // Game end notification
        this.network.on("game_end", (msg) => {
            if (msg.payload.match_id === this.matchId) {
                this.handleGameEnd(msg.payload);
            }
        });

        // Chat message notification
        this.network.on("chat_message", (msg) => {
            if (msg.payload.match_id === this.matchId) {
                this.handleChatMessage(msg.payload);
            }
        });

        // Match found
        this.network.on("match_found", (msg) => {
            this.handleMatchFound(msg.payload);
        });
    }

    async makeMove(fromRow, fromCol, toRow, toCol) {
        // Validate move locally first
        if (!this.game.isValidMove(fromRow, fromCol, toRow, toCol)) {
            throw new Error("Invalid move");
        }

        // Execute move locally
        const moveResult = this.game.makeMove(fromRow, fromCol, toRow, toCol);

        // Send to server
        if (this.isOnlineMode) {
            try {
                await this.network.sendMove(
                    this.matchId,
                    fromRow,
                    fromCol,
                    toRow,
                    toCol,
                    moveResult.piece.type,
                    moveResult.captured?.type
                );
            } catch (error) {
                // Rollback move on server error
                this.game.undoMove();
                throw error;
            }
        }

        return moveResult;
    }

    handleOpponentMove(payload) {
        // Apply opponent's move to our game state
        this.game.makeMove(
            payload.from_row,
            payload.from_col,
            payload.to_row,
            payload.to_col
        );

        // Notify UI
        if (this.onMoveReceived) {
            this.onMoveReceived(payload);
        }
    }

    handleGameEnd(payload) {
        if (this.onGameEnd) {
            this.onGameEnd(payload);
        }
    }

    handleChatMessage(payload) {
        if (this.onChatMessage) {
            this.onChatMessage(payload);
        }
    }

    async sendChatMessage(message) {
        if (!this.isOnlineMode || !this.matchId) return;
        await this.network.sendChatMessage(this.matchId, message);
    }
}
```

#### 3. Application Controller

```javascript
// src/app/app.js

class App {
    constructor() {
        this.network = new WebSocketBridge("ws://localhost:8080/ws");
        this.gameController = null;
        this.currentScreen = "auth";
        this.currentUser = null;
    }

    async init() {
        this.setupEventListeners();
        await this.network.connect();
        this.showScreen("auth");
    }

    setupEventListeners() {
        // Auth screen
        document.getElementById("login-btn").addEventListener("click", () => {
            this.handleLogin();
        });

        // Game screen
        document
            .getElementById("send-chat-btn")
            .addEventListener("click", () => {
                this.handleSendGameChat();
            });

        // Network events
        this.network.on("disconnected", () => {
            this.handleDisconnected();
        });
    }

    setupGameCallbacks() {
        this.gameController.onMoveReceived = (payload) => {
            this.renderer.animateMove(payload);
        };

        this.gameController.onGameEnd = (payload) => {
            this.showGameResult(payload);
        };

        this.gameController.onChatMessage = (payload) => {
            this.handleChatMessageReceived(payload);
        };
    }

    async handleLogin() {
        const username = document.getElementById("username-input").value;
        const password = document.getElementById("password-input").value;

        try {
            const userData = await this.network.login(username, password);
            this.currentUser = userData;
            this.showScreen("lobby");
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleSendGameChat() {
        const input = document.getElementById("game-chat-input");
        const message = input.value.trim();

        if (!message) return;

        // Validate
        const validation = validateChatMessage(message);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }

        try {
            await this.gameController.sendChatMessage(validation.sanitized);
            input.value = "";
        } catch (error) {
            this.showError("Failed to send message");
        }
    }

    handleChatMessageReceived(payload) {
        this.addChatMessage(
            "game-chat-messages",
            payload.username,
            payload.message
        );
    }
}
```

---

## 📡 Network Protocol

### Message Structure

**Base Format:**

```json
{
  "type": "message_type",
  "seq": 123,
  "payload": { ... }
}
```

**Response Format:**

```json
{
  "type": "response",
  "seq": 123,
  "success": true|false,
  "message": "Description",
  "data": { ... }
}
```

### Message Catalog

#### 1. Authentication

**Register:**

```json
// Request
{
  "type": "register",
  "seq": 1,
  "payload": {
    "username": "player1",
    "password": "secret123",
    "email": "player1@example.com"
  }
}

// Response
{
  "type": "response",
  "seq": 1,
  "success": true,
  "message": "Registration successful",
  "data": {
    "user_id": 42,
    "username": "player1",
    "token": "abc123...",
    "rating": 1200
  }
}
```

**Login:**

```json
// Request
{
  "type": "login",
  "seq": 2,
  "payload": {
    "username": "player1",
    "password": "secret123"
  }
}

// Response
{
  "type": "response",
  "seq": 2,
  "success": true,
  "data": {
    "user_id": 42,
    "username": "player1",
    "token": "abc123...",
    "rating": 1250,
    "wins": 10,
    "losses": 5,
    "draws": 2
  }
}
```

#### 2. Matchmaking

**Find Match:**

```json
// Request
{
  "type": "find_match",
  "seq": 3,
  "payload": {
    "token": "abc123...",
    "is_ranked": true
  }
}

// Broadcast (to both players)
{
  "type": "match_found",
  "payload": {
    "match_id": 100,
    "red_user_id": 42,
    "black_user_id": 99,
    "your_color": "red",
    "opponent": {
      "user_id": 99,
      "username": "player2",
      "rating": 1240
    }
  }
}
```

**Challenge:**

```json
// Request
{
  "type": "challenge",
  "seq": 4,
  "payload": {
    "token": "abc123...",
    "opponent_user_id": 99,
    "is_ranked": false
  }
}

// Notification to opponent
{
  "type": "challenge_received",
  "payload": {
    "challenger_user_id": 42,
    "challenger_username": "player1",
    "challenger_rating": 1250,
    "is_ranked": false
  }
}
```

#### 3. Gameplay

**Move:**

```json
// Request
{
  "type": "move",
  "seq": 5,
  "payload": {
    "token": "abc123...",
    "match_id": 100,
    "from_row": 0,
    "from_col": 4,
    "to_row": 1,
    "to_col": 4,
    "piece_type": "general",
    "captured_piece": null
  }
}

// Broadcast (to both players)
{
  "type": "move",
  "payload": {
    "match_id": 100,
    "player": "red",
    "from_row": 0,
    "from_col": 4,
    "to_row": 1,
    "to_col": 4,
    "piece_type": "general",
    "captured": null
  }
}
```

**Resign:**

```json
// Request
{
  "type": "resign",
  "seq": 6,
  "payload": {
    "token": "abc123...",
    "match_id": 100
  }
}

// Broadcast
{
  "type": "game_end",
  "payload": {
    "match_id": 100,
    "winner": "black",
    "reason": "resignation",
    "rating_changes": {
      "red": -15,
      "black": +15
    }
  }
}
```

#### 4. Chat

**Chat Message:**

```json
// Request
{
  "type": "chat_message",
  "seq": 7,
  "payload": {
    "token": "abc123...",
    "match_id": 100,
    "message": "Good game!"
  }
}

// Broadcast (to both players)
{
  "type": "chat_message",
  "payload": {
    "match_id": 100,
    "user_id": 42,
    "username": "player1",
    "message": "Good game!",
    "timestamp": 1698765432
  }
}
```

---

## 💾 Database Schema

### Tables

#### Users

```sql
CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    username NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(64) NOT NULL,
    email NVARCHAR(100) UNIQUE,
    rating INT DEFAULT 1200,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_users_username ON Users(username);
CREATE INDEX idx_users_rating ON Users(rating DESC);
```

#### Sessions

```sql
CREATE TABLE Sessions (
    token NVARCHAR(64) PRIMARY KEY,
    user_id INT FOREIGN KEY REFERENCES Users(id),
    created_at DATETIME DEFAULT GETDATE(),
    expires_at DATETIME NOT NULL
);

CREATE INDEX idx_sessions_user_id ON Sessions(user_id);
CREATE INDEX idx_sessions_expires ON Sessions(expires_at);
```

#### Matches

```sql
CREATE TABLE Matches (
    id INT PRIMARY KEY IDENTITY(1,1),
    red_user_id INT FOREIGN KEY REFERENCES Users(id),
    black_user_id INT FOREIGN KEY REFERENCES Users(id),
    winner NVARCHAR(10),  -- 'red', 'black', 'draw'
    result_reason NVARCHAR(50),  -- 'checkmate', 'resignation', 'draw_agreement'
    is_ranked BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    ended_at DATETIME
);

CREATE INDEX idx_matches_red_user ON Matches(red_user_id);
CREATE INDEX idx_matches_black_user ON Matches(black_user_id);
CREATE INDEX idx_matches_created ON Matches(created_at DESC);
```

#### Moves

```sql
CREATE TABLE Moves (
    id INT PRIMARY KEY IDENTITY(1,1),
    match_id INT FOREIGN KEY REFERENCES Matches(id),
    move_number INT NOT NULL,
    player NVARCHAR(10) NOT NULL,  -- 'red' or 'black'
    from_row INT NOT NULL,
    from_col INT NOT NULL,
    to_row INT NOT NULL,
    to_col INT NOT NULL,
    piece_type NVARCHAR(20) NOT NULL,
    captured_piece NVARCHAR(20),
    timestamp DATETIME DEFAULT GETDATE()
);

CREATE INDEX idx_moves_match_id ON Moves(match_id, move_number);
```

### Relationships

```
Users 1──N Sessions
Users 1──N Matches (as red_user_id)
Users 1──N Matches (as black_user_id)
Matches 1──N Moves
```

---

## 🎮 Game Logic

### Piece Movement Rules

#### General (Tướng)

```javascript
class General {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        // Within palace (3x3 area)
        if (!this.isInPalace(toRow, toCol)) return false;

        // Move one step horizontally or vertically
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        return (
            (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)
        );
    }

    isInPalace(row, col) {
        if (this.color === "red") {
            return row >= 7 && row <= 9 && col >= 3 && col <= 5;
        } else {
            return row >= 0 && row <= 2 && col >= 3 && col <= 5;
        }
    }
}
```

#### Advisor (Sĩ)

```javascript
class Advisor {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        // Within palace
        if (!this.isInPalace(toRow, toCol)) return false;

        // Move diagonally one step
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        return rowDiff === 1 && colDiff === 1;
    }
}
```

#### Elephant (Tượng)

```javascript
class Elephant {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        // Cannot cross river
        if (!this.isOnOwnSide(toRow)) return false;

        // Move exactly 2 diagonally
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;

        if (Math.abs(rowDiff) !== 2 || Math.abs(colDiff) !== 2) {
            return false;
        }

        // Check blocking piece (elephant eye)
        const midRow = fromRow + rowDiff / 2;
        const midCol = fromCol + colDiff / 2;

        return board[midRow][midCol] === null;
    }
}
```

#### Horse (Mã)

```javascript
class Horse {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        // L-shaped move (2+1 or 1+2)
        if (
            !(
                (rowDiff === 2 && colDiff === 1) ||
                (rowDiff === 1 && colDiff === 2)
            )
        ) {
            return false;
        }

        // Check blocking piece (horse leg)
        let blockRow, blockCol;
        if (rowDiff === 2) {
            blockRow = fromRow + (toRow - fromRow) / 2;
            blockCol = fromCol;
        } else {
            blockRow = fromRow;
            blockCol = fromCol + (toCol - fromCol) / 2;
        }

        return board[blockRow][blockCol] === null;
    }
}
```

#### Chariot (Xe)

```javascript
class Chariot {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        // Must move in straight line
        if (fromRow !== toRow && fromCol !== toCol) {
            return false;
        }

        // Check path is clear
        return this.isPathClear(fromRow, fromCol, toRow, toCol, board);
    }

    isPathClear(fromRow, fromCol, toRow, toCol, board) {
        if (fromRow === toRow) {
            // Horizontal
            const start = Math.min(fromCol, toCol) + 1;
            const end = Math.max(fromCol, toCol);
            for (let col = start; col < end; col++) {
                if (board[fromRow][col] !== null) return false;
            }
        } else {
            // Vertical
            const start = Math.min(fromRow, toRow) + 1;
            const end = Math.max(fromRow, toRow);
            for (let row = start; row < end; row++) {
                if (board[row][fromCol] !== null) return false;
            }
        }
        return true;
    }
}
```

#### Cannon (Pháo)

```javascript
class Cannon {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        // Must move in straight line
        if (fromRow !== toRow && fromCol !== toCol) {
            return false;
        }

        const targetPiece = board[toRow][toCol];
        const piecesBetween = this.countPiecesBetween(
            fromRow,
            fromCol,
            toRow,
            toCol,
            board
        );

        if (targetPiece === null) {
            // Moving without capturing: no pieces between
            return piecesBetween === 0;
        } else {
            // Capturing: exactly one piece between (platform)
            return piecesBetween === 1;
        }
    }
}
```

#### Soldier (Tốt)

```javascript
class Soldier {
    canMove(fromRow, fromCol, toRow, toCol, board) {
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);

        // Can only move forward (or sideways after crossing river)
        if (this.color === "red") {
            // Red moves upward (decreasing row)
            if (rowDiff > 0) return false;

            if (fromRow > 4) {
                // Before river: only forward
                return rowDiff === -1 && colDiff === 0;
            } else {
                // After river: forward or sideways
                return (
                    (rowDiff === -1 && colDiff === 0) ||
                    (rowDiff === 0 && colDiff === 1)
                );
            }
        } else {
            // Black moves downward (increasing row)
            if (rowDiff < 0) return false;

            if (fromRow < 5) {
                // Before river: only forward
                return rowDiff === 1 && colDiff === 0;
            } else {
                // After river: forward or sideways
                return (
                    (rowDiff === 1 && colDiff === 0) ||
                    (rowDiff === 0 && colDiff === 1)
                );
            }
        }
    }
}
```

### Check Detection

```javascript
class Board {
    isInCheck(color) {
        const general = this.findGeneral(color);
        if (!general) return false;

        // Check if any enemy piece can capture the general
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color !== color) {
                    if (
                        piece.canMove(
                            row,
                            col,
                            general.row,
                            general.col,
                            this.board
                        )
                    ) {
                        return true;
                    }
                }
            }
        }

        // Check flying general rule
        const enemyGeneral = this.findGeneral(
            color === "red" ? "black" : "red"
        );
        if (enemyGeneral && general.col === enemyGeneral.col) {
            // Check if path is clear
            const start = Math.min(general.row, enemyGeneral.row) + 1;
            const end = Math.max(general.row, enemyGeneral.row);
            let blocked = false;
            for (let row = start; row < end; row++) {
                if (this.board[row][general.col] !== null) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) return true; // Flying general!
        }

        return false;
    }

    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;

        // Try all possible moves
        for (let fromRow = 0; fromRow < 10; fromRow++) {
            for (let fromCol = 0; fromCol < 9; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece && piece.color === color) {
                    for (let toRow = 0; toRow < 10; toRow++) {
                        for (let toCol = 0; toCol < 9; toCol++) {
                            if (
                                piece.canMove(
                                    fromRow,
                                    fromCol,
                                    toRow,
                                    toCol,
                                    this.board
                                )
                            ) {
                                // Try the move
                                const backup = this.board[toRow][toCol];
                                this.board[toRow][toCol] = piece;
                                this.board[fromRow][fromCol] = null;

                                // Check if still in check
                                const stillInCheck = this.isInCheck(color);

                                // Undo the move
                                this.board[fromRow][fromCol] = piece;
                                this.board[toRow][toCol] = backup;

                                if (!stillInCheck) {
                                    return false; // Found escape move
                                }
                            }
                        }
                    }
                }
            }
        }

        return true; // No escape moves = checkmate
    }
}
```

---

## 🔒 Security

### Authentication

**Token Generation:**

```c
void generate_token(char* out_token) {
    unsigned char random_bytes[32];
    RAND_bytes(random_bytes, 32);

    // Convert to hex string
    for (int i = 0; i < 32; i++) {
        sprintf(out_token + i * 2, "%02x", random_bytes[i]);
    }
    out_token[64] = '\0';
}
```

**Token Validation:**

```c
bool validate_token_and_get_user(const char* token, int* out_user_id) {
    // Query database
    const char* sql = "SELECT user_id, expires_at FROM Sessions WHERE token = ?";

    // ... execute query ...

    // Check expiration
    time_t expires_at = /* from result */;
    if (time(NULL) > expires_at) {
        // Delete expired session
        db_delete_session(token);
        return false;
    }

    *out_user_id = /* from result */;
    return true;
}
```

### Input Validation

**Server-side:**

```c
// Validate username
if (strlen(username) < 3 || strlen(username) > 20) {
    send_error(client, seq, "Username must be 3-20 characters");
    return;
}

// Check alphanumeric
for (int i = 0; username[i]; i++) {
    if (!isalnum(username[i]) && username[i] != '_') {
        send_error(client, seq, "Username can only contain letters, numbers, and underscore");
        return;
    }
}
```

**Client-side:**

```javascript
function validateChatMessage(message) {
    if (!message || message.trim().length === 0) {
        return { valid: false, error: "Message cannot be empty" };
    }

    if (message.length > 500) {
        return { valid: false, error: "Message too long (max 500 chars)" };
    }

    // Sanitize HTML
    const sanitized = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    return { valid: true, sanitized };
}
```

### SQL Injection Prevention

```c
// Use prepared statements
SQLHSTMT stmt;
SQLAllocHandle(SQL_HANDLE_STMT, db_conn, &stmt);

const char* sql = "INSERT INTO Users (username, password_hash, email) VALUES (?, ?, ?)";
SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);

// Bind parameters
SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 50, 0,
                 (SQLPOINTER)username, 0, NULL);
SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                 (SQLPOINTER)password_hash, 0, NULL);
SQLBindParameter(stmt, 3, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 100, 0,
                 (SQLPOINTER)email, 0, NULL);

SQLExecute(stmt);
```

---

## ⚡ Performance

### Server Optimizations

**Epoll (Event-driven I/O):**

```c
// O(1) complexity for adding/removing file descriptors
// Only returns active file descriptors (not all monitored)

int epoll_fd = epoll_create1(0);

struct epoll_event ev;
ev.events = EPOLLIN | EPOLLET;  // Edge-triggered
ev.data.fd = client_fd;
epoll_ctl(epoll_fd, EPOLL_CTL_ADD, client_fd, &ev);

// Wait for events (non-blocking)
struct epoll_event events[MAX_EVENTS];
int n = epoll_wait(epoll_fd, events, MAX_EVENTS, timeout);
```

**Connection Pooling:**

```c
// Reuse client structures instead of malloc/free
client_t client_pool[MAX_CLIENTS];
int free_clients[MAX_CLIENTS];
int free_count = MAX_CLIENTS;

client_t* acquire_client() {
    if (free_count == 0) return NULL;
    return &client_pool[free_clients[--free_count]];
}

void release_client(client_t* client) {
    free_clients[free_count++] = client - client_pool;
}
```

### Client Optimizations

**Canvas Rendering:**

```javascript
// Use requestAnimationFrame for smooth animations
function render() {
    // Clear only changed regions
    ctx.clearRect(changedArea.x, changedArea.y, changedArea.w, changedArea.h);

    // Batch draw calls
    ctx.save();
    for (const piece of visiblePieces) {
        drawPiece(piece);
    }
    ctx.restore();

    requestAnimationFrame(render);
}
```

**Message Batching:**

```javascript
// Batch multiple updates into single message
const updateBatcher = {
    updates: [],
    timeout: null,

    add(update) {
        this.updates.push(update);

        if (!this.timeout) {
            this.timeout = setTimeout(() => {
                this.flush();
            }, 16); // ~60 FPS
        }
    },

    flush() {
        if (this.updates.length > 0) {
            network.send("batch_update", { updates: this.updates });
            this.updates = [];
        }
        this.timeout = null;
    },
};
```

---

## 💡 Code Examples

### Complete Registration Flow

**Client:**

```javascript
async function register(username, password, email) {
    // Validate
    if (!validateUsername(username)) {
        throw new Error("Invalid username");
    }

    if (!validatePassword(password)) {
        throw new Error("Password must be at least 8 characters");
    }

    // Send request
    try {
        const response = await network.send("register", {
            username,
            password,
            email,
        });

        // Store token
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("user_id", response.data.user_id);
        sessionStorage.setItem("username", response.data.username);

        return response.data;
    } catch (error) {
        console.error("Registration failed:", error);
        throw error;
    }
}
```

**Server:**

```c
void handle_register(server_t* server, client_t* client, message_t* msg) {
    // Extract
    const char* username = json_get_string(msg->payload, "username");
    const char* password = json_get_string(msg->payload, "password");
    const char* email = json_get_string(msg->payload, "email");

    // Validate
    if (!validate_username(username)) {
        send_error(client, msg->seq, "Invalid username");
        return;
    }

    // Hash password
    char hash[65];
    sha256(password, hash);

    // Create user
    int user_id;
    if (!db_create_user(username, hash, email, &user_id)) {
        send_error(client, msg->seq, "Username already exists");
        return;
    }

    // Generate token
    char token[65];
    generate_token(token);

    // Create session
    time_t expires = time(NULL) + SESSION_EXPIRE_SECONDS;
    db_create_session(user_id, token, expires);

    // Update client
    client->user_id = user_id;
    strcpy(client->token, token);

    // Respond
    char data[512];
    snprintf(data, sizeof(data),
             "{\"user_id\":%d,\"username\":\"%s\",\"token\":\"%s\",\"rating\":1200}",
             user_id, username, token);
    send_response(client, msg->seq, true, "Registration successful", data);

    printf("[Auth] Registered: %s (ID: %d)\n", username, user_id);
}
```

### Complete Game Flow

**Starting a match:**

```javascript
// Client finds match
await network.findMatch(true); // ranked

// Server matches players and broadcasts
network.on("match_found", (payload) => {
    // payload: { match_id, your_color, opponent: {...} }

    gameController = new NetworkGameController(network);
    gameController.matchId = payload.match_id;
    gameController.playerColor = payload.your_color;

    showGameScreen(payload);
});
```

**Making a move:**

```javascript
// Client makes move (via UI click)
try {
    await gameController.makeMove(fromRow, fromCol, toRow, toCol);
    // Move validated, sent to server, and executed locally
} catch (error) {
    showError(error.message);
}

// Server validates and broadcasts
// Opponent receives broadcast
network.on("move", (payload) => {
    gameController.handleOpponentMove(payload);
    renderer.animateMove(payload);
});
```

**Ending game:**

```javascript
// Player resigns
await network.resign(matchId);

// Server ends match and broadcasts
network.on("game_end", (payload) => {
    // payload: { winner, reason, rating_changes }
    showGameResult(payload);
    updateRating(payload.rating_changes);
});
```

---

## 📚 References

-   **Xiangqi Rules**: [Wikipedia](https://en.wikipedia.org/wiki/Xiangqi)
-   **Epoll**: [Linux man page](https://man7.org/linux/man-pages/man7/epoll.7.html)
-   **WebSocket Protocol**: [RFC 6455](https://tools.ietf.org/html/rfc6455)
-   **Elo Rating**: [Wikipedia](https://en.wikipedia.org/wiki/Elo_rating_system)

---

<p align="center">
  <strong>End of Technical Documentation</strong>
</p>
