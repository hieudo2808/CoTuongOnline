# 🏗️ Implementation Guide - Complete Steps

## 📋 Overview

Tài liệu này hướng dẫn chi tiết để hoàn thiện toàn bộ hệ thống multiplayer. Đã có ~60% code template, cần hoàn thiện ~40% còn lại.

---

## ✅ Current Status

### ✓ Đã có (Template/Hoàn chỉnh)

#### Server Infrastructure

-   [x] Server main loop with epoll (server.c) - ⚠️ cần thêm message handlers
-   [x] Protocol parsing (protocol.c) - ⚠️ cần improve JSON parser
-   [x] Database operations (db.c) - ✅ hoàn chỉnh
-   [x] Session management (session.c) - ✅ hoàn chỉnh
-   [x] Rating system (rating.c) - ✅ hoàn chỉnh
-   [x] Account management (account.c) - ✅ hoàn chỉnh
-   [x] Lobby system (lobby.c) - ⚠️ cần hoàn thiện challenge & room
-   [x] Match management (match.c) - ⚠️ cần thêm move validation

#### Client & Integration

-   [x] C Client (client.c) - ✅ hoàn chỉnh
-   [x] JavaScript Bridge (networkBridge.js) - ✅ hoàn chỉnh
-   [x] Build scripts (Makefile, build.sh) - ✅ hoàn chỉnh
-   [x] Database schema (schema.sql) - ✅ hoàn chỉnh

#### Documentation

-   [x] README - ✅ hoàn chỉnh
-   [x] Protocol specification - ✅ hoàn chỉnh
-   [x] API documentation - ✅ hoàn chỉnh
-   [x] Deployment guide - ✅ hoàn chỉnh

---

## ⚠️ TODO - Cần hoàn thiện

### 1. Server Message Handlers (CRITICAL)

**File: `network/c_server/src/handlers.c` (NEW)**

Cần implement handlers cho tất cả message types:

```c
// handlers.c
void handle_register(server_t *server, client_t *client, message_t *msg);
void handle_login(server_t *server, client_t *client, message_t *msg);
void handle_logout(server_t *server, client_t *client, message_t *msg);
void handle_set_ready(server_t *server, client_t *client, message_t *msg);
void handle_find_match(server_t *server, client_t *client, message_t *msg);
void handle_move(server_t *server, client_t *client, message_t *msg);
void handle_resign(server_t *server, client_t *client, message_t *msg);
void handle_draw_offer(server_t *server, client_t *client, message_t *msg);
void handle_draw_response(server_t *server, client_t *client, message_t *msg);
void handle_challenge(server_t *server, client_t *client, message_t *msg);
void handle_challenge_response(server_t *server, client_t *client, message_t *msg);
void handle_rematch_request(server_t *server, client_t *client, message_t *msg);
void handle_get_match(server_t *server, client_t *client, message_t *msg);
void handle_leaderboard(server_t *server, client_t *client, message_t *msg);
void handle_heartbeat(server_t *server, client_t *client, message_t *msg);
```

**Ước lượng:** ~500 dòng code

---

### 2. Complete Lobby Functions

**File: `network/c_server/src/lobby.c`**

Cần implement:

-   `lobby_join_room()` - Join private room
-   `lobby_close_room()` - Close room
-   `lobby_create_challenge()` - Create challenge
-   `lobby_get_challenge()` - Get challenge details
-   `lobby_accept_challenge()` - Accept challenge
-   `lobby_decline_challenge()` - Decline challenge

**Ước lượng:** ~200 dòng code

---

### 3. Game Logic Validation (Optional nhưng nên có)

**File: `network/c_server/src/game_logic.c` (NEW)**

Validate move legality:

```c
bool validate_move(const char *board_state,
                   const char *piece_type,
                   int from_row, int from_col,
                   int to_row, int to_col);

bool is_checkmate(const char *board_state, const char *color);
bool is_check(const char *board_state, const char *color);
```

**Option 1:** Port JavaScript logic to C (nặng, ~500 dòng)
**Option 2:** Call JS validator via subprocess (dễ hơn)
**Option 3:** Basic sanity check only (đã có)

**Recommended:** Option 2 hoặc Option 3

---

### 4. Broadcast Functions

**File: `network/c_server/src/broadcast.c` (NEW)**

```c
// Broadcast to all clients in match
void broadcast_to_match(server_t *server, const char *match_id, const char *json);

// Broadcast to all ready players
void broadcast_to_lobby(server_t *server, const char *json);

// Send to specific user
bool send_to_user(server_t *server, int user_id, const char *json);
```

**Ước lượng:** ~100 dòng code

---

### 5. Better JSON Parser (Optional)

Hiện tại dùng simple parser. Nên dùng **cJSON** library.

**Install cJSON:**

```bash
sudo apt-get install -y libcjson-dev
```

**Update Makefile:**

```makefile
LDFLAGS = -pthread -lsqlite3 -lm -lcjson
```

**Ước lượng:** ~2h refactor

---

### 6. JavaScript UI Integration

**File: `src/core/networkGameController.js` (NEW)**

Wrapper around GameController với network support:

```javascript
export class NetworkGameController extends GameController {
    constructor(network) {
        super();
        this.network = network;
        this.setupNetworkHandlers();
    }

    setupNetworkHandlers() {
        this.network.on("match_found", (msg) => this.handleMatchFound(msg));
        this.network.on("opponent_move", (msg) => this.handleOpponentMove(msg));
        this.network.on("game_end", (msg) => this.handleGameEnd(msg));
    }

    // Override executeMove to send to server
    executeMove(newRow, newCol) {
        const moveData = {
            match_id: this.matchId,
            from: { row: this.curPiece.row, col: this.curPiece.col },
            to: { row: newRow, col: newCol },
            // ...
        };

        // Send to server
        this.network.sendMove(this.matchId, moveData);

        // Wait for server confirmation before executing locally
    }
}
```

**Ước lượng:** ~300 dòng code

---

### 7. Testing Suite

**Files:**

-   `network/c_server/tests/test_protocol.c`
-   `network/c_server/tests/test_db.c`
-   `network/c_server/tests/test_session.c`
-   `network/c_server/tests/test_lobby.c`
-   `network/c_server/tests/test_match.c`

**Ước lượng:** ~400 dòng code

---

## 🚀 Step-by-Step Implementation Plan

### Phase 1: Core Functionality (Week 1)

**Day 1-2: Message Handlers**

1. Implement `handlers.c` với tất cả message types
2. Integrate vào `server.c` trong `process_message()`
3. Test register/login flow

**Day 3-4: Lobby & Matching**

1. Complete lobby functions (challenge, room)
2. Test matchmaking
3. Test challenge flow

**Day 5-6: In-game**

1. Implement move handling
2. Test move transmission
3. Implement resign/draw

**Day 7: Post-game**

1. Implement match logging
2. Implement leaderboard
3. Test replay

---

### Phase 2: Integration (Week 2)

**Day 1-2: JavaScript Bridge**

1. Implement NetworkGameController
2. Integrate với UI hiện tại
3. Test full flow trong browser

**Day 3-4: Testing**

1. Write unit tests
2. Write integration tests
3. Fix bugs

**Day 5-6: Polish**

1. Error handling
2. Edge cases
3. UI improvements

**Day 7: Documentation**

1. Update docs
2. Create video demo
3. Write final report

---

## 📝 Implementation Template Examples

### Example: Register Handler

```c
// handlers.c
void handle_register(server_t *server, client_t *client, message_t *msg) {
    // Parse payload
    char *username = json_get_string(msg->payload_json, "username");
    char *email = json_get_string(msg->payload_json, "email");
    char *password_hash = json_get_string(msg->payload_json, "password");

    if (!username || !email || !password_hash) {
        char *err = create_error(msg->seq, "INVALID_PAYLOAD", "Missing fields", false);
        client_send(client, err);
        free(err);
        goto cleanup;
    }

    // Register account
    int user_id;
    bool success = account_register(username, email, password_hash, &user_id);

    // Build response
    char payload[512];
    if (success) {
        snprintf(payload, sizeof(payload),
                "{\"success\":true,\"message\":\"Registration successful\",\"user_id\":%d}",
                user_id);
    } else {
        snprintf(payload, sizeof(payload),
                "{\"success\":false,\"error\":\"Username or email already exists\"}");
    }

    char *response = create_response("register_response", msg->seq, NULL, payload);
    client_send(client, response);
    free(response);

cleanup:
    free(username);
    free(email);
    free(password_hash);
}
```

### Example: Match Found Broadcast

```c
void broadcast_match_found(server_t *server, const char *match_id,
                          int red_user_id, int black_user_id) {
    match_t *match = match_get(match_id);
    if (!match) return;

    // Get user info
    user_t red_user, black_user;
    account_get_by_id(red_user_id, &red_user);
    account_get_by_id(black_user_id, &black_user);

    // Build message for red player
    char red_payload[2048];
    snprintf(red_payload, sizeof(red_payload),
            "{\"match_id\":\"%s\","
            "\"opponent\":{\"user_id\":%d,\"username\":\"%s\",\"rating\":%d},"
            "\"your_color\":\"red\","
            "\"initial_position\":\"rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR\"}",
            match_id, black_user.user_id, black_user.username, black_user.rating);

    char *red_msg = create_response("match_found", 0, NULL, red_payload);
    send_to_user(server, red_user_id, red_msg);
    free(red_msg);

    // Build message for black player (similar)
    // ...
}
```

---

## 🎯 Priority Tasks (If Time Limited)

### Must Have (để pass yêu cầu tối thiểu)

1. ✅ Register/Login handlers
2. ✅ Session management
3. ✅ Random matchmaking
4. ✅ Move transmission
5. ✅ Basic move validation (turn check)
6. ✅ Game result
7. ✅ Leaderboard

### Should Have (để đạt điểm cao)

8. Rating-based matchmaking
9. Challenge system
10. Private rooms
11. Resign/Draw
12. Rematch
13. Match replay

### Nice to Have (bonus)

14. In-game chat
15. Reconnection
16. Spectator mode
17. Full move validation
18. Anti-cheat

---

## 🧪 Testing Checklist

-   [ ] 2 clients register successfully
-   [ ] Login with correct credentials
-   [ ] Login fails with wrong credentials
-   [ ] Set ready → appears in ready list
-   [ ] Random match → match created
-   [ ] Rating match → matched by rating
-   [ ] Send move → opponent receives
-   [ ] Invalid move → rejected
-   [ ] Resign → game ends
-   [ ] Draw offer → opponent receives
-   [ ] Challenge user → notification sent
-   [ ] Accept challenge → match starts
-   [ ] Leaderboard updates after game
-   [ ] Reconnection works
-   [ ] Server handles 10+ concurrent matches

---

## 📚 Reference Code Locations

### Server

-   Main loop: `c_server/src/server.c:330-370`
-   Message processing: `c_server/src/server.c:264-290`
-   Protocol: `c_server/src/protocol.c`

### Client

-   Connection: `c_client/src/client.c:30-80`
-   Send: `c_client/src/client.c:100-120`
-   Receive: `c_client/src/client.c:140-200`

### Database

-   Schema: `sql/schema.sql`
-   Operations: `c_server/src/db.c`

---

## 💬 Need Help?

### Common Issues & Solutions

**Issue:** Can't compile server
**Solution:**

```bash
sudo apt-get install build-essential libsqlite3-dev
cd network/c_server
make clean && make
```

**Issue:** Client can't connect
**Solution:**

```bash
# Check server is running
ps aux | grep server
# Check port
netstat -tuln | grep 9000
```

**Issue:** Database error
**Solution:**

```bash
cd c_server
rm xiangqi.db
sqlite3 xiangqi.db < ../sql/schema.sql
```

---

## 📞 Contact & Support

-   Check `protocol.md` for message formats
-   Check `API.md` for C client usage
-   Check `deployment.md` for hosting

---

**Tổng ước lượng công việc còn lại:** ~1500 dòng code + testing + integration

**Thời gian:** 1-2 tuần (full-time) hoặc 2-3 tuần (part-time)

Chúc bạn thành công! 🚀
