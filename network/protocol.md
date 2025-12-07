# Giao thức JSON - Xiangqi Multiplayer

## 📋 Tổng quan

-   **Transport**: TCP
-   **Framing**: Newline-delimited (`\n`)
-   **Format**: JSON
-   **Encoding**: UTF-8

## 🔹 Message Envelope

Mọi message đều có format:

```json
{
    "type": "message_type",
    "seq": 1234,
    "token": "session-token-or-null",
    "payload": {
        /* specific to message type */
    }
}
```

### Fields:

-   `type` (string, required): Loại message
-   `seq` (int, required): Sequence number để track message order
-   `token` (string, optional): Session token (null cho register/login)
-   `payload` (object, required): Dữ liệu cụ thể

## 📨 Message Types

### 1. Authentication & Account

#### 1.1 Register

**Client → Server**

```json
{
    "type": "register",
    "seq": 1,
    "token": null,
    "payload": {
        "username": "player1",
        "email": "player1@example.com",
        "password": "hashed_password_sha256"
    }
}
```

**Server → Client (Success)**

```json
{
    "type": "register_response",
    "seq": 1,
    "token": null,
    "payload": {
        "success": true,
        "message": "Registration successful",
        "user_id": 12345
    }
}
```

**Server → Client (Error)**

```json
{
    "type": "register_response",
    "seq": 1,
    "token": null,
    "payload": {
        "success": false,
        "error": "Username already exists"
    }
}
```

#### 1.2 Login

**Client → Server**

```json
{
    "type": "login",
    "seq": 2,
    "token": null,
    "payload": {
        "username": "player1",
        "password": "hashed_password_sha256"
    }
}
```

**Server → Client (Success)**

```json
{
    "type": "login_response",
    "seq": 2,
    "token": "abc123xyz789token",
    "payload": {
        "success": true,
        "user_id": 12345,
        "username": "player1",
        "rating": 1200,
        "wins": 10,
        "losses": 5,
        "draws": 2
    }
}
```

#### 1.3 Logout

**Client → Server**

```json
{
    "type": "logout",
    "seq": 3,
    "token": "abc123xyz789token",
    "payload": {}
}
```

**Server → Client**

```json
{
    "type": "logout_response",
    "seq": 3,
    "token": null,
    "payload": {
        "success": true,
        "message": "Logged out successfully"
    }
}
```

### 2. Lobby & Matchmaking

#### 2.1 Set Ready

**Client → Server**

```json
{
    "type": "set_ready",
    "seq": 10,
    "token": "abc123xyz789token",
    "payload": {
        "ready": true
    }
}
```

**Server → All Clients (Broadcast)**

```json
{
    "type": "ready_list",
    "seq": 0,
    "token": null,
    "payload": {
        "ready_players": [
            { "user_id": 12345, "username": "player1", "rating": 1200 },
            { "user_id": 67890, "username": "player2", "rating": 1250 }
        ]
    }
}
```

#### 2.2 Random Match

**Client → Server**

```json
{
    "type": "find_match",
    "seq": 11,
    "token": "abc123xyz789token",
    "payload": {
        "match_type": "random"
    }
}
```

#### 2.3 Rating-based Match

**Client → Server**

```json
{
    "type": "find_match",
    "seq": 12,
    "token": "abc123xyz789token",
    "payload": {
        "match_type": "rated",
        "rating_tolerance": 100
    }
}
```

**Server → Client (Match Found)**

```json
{
    "type": "match_found",
    "seq": 0,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "opponent": {
            "user_id": 67890,
            "username": "player2",
            "rating": 1250
        },
        "your_color": "red",
        "initial_position": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR",
        "time_control": {
            "initial_seconds": 600,
            "increment_seconds": 5
        }
    }
}
```

#### 2.4 Create Private Room

**Client → Server**

```json
{
    "type": "create_room",
    "seq": 13,
    "token": "abc123xyz789token",
    "payload": {
        "room_name": "My Room",
        "password": "optional_password",
        "rated": false
    }
}
```

**Server → Client**

```json
{
    "type": "create_room_response",
    "seq": 13,
    "token": null,
    "payload": {
        "success": true,
        "room_id": "room_xyz789",
        "room_code": "ABCD1234"
    }
}
```

#### 2.5 Join Room

**Client → Server**

```json
{
    "type": "join_room",
    "seq": 14,
    "token": "abc123xyz789token",
    "payload": {
        "room_code": "ABCD1234",
        "password": "optional_password"
    }
}
```

#### 2.6 Challenge User

**Client → Server**

```json
{
    "type": "challenge",
    "seq": 15,
    "token": "abc123xyz789token",
    "payload": {
        "opponent_id": 67890,
        "rated": true,
        "time_control": {
            "initial_seconds": 600,
            "increment_seconds": 5
        }
    }
}
```

**Server → Opponent**

```json
{
    "type": "challenge_received",
    "seq": 0,
    "token": null,
    "payload": {
        "challenge_id": "challenge_123",
        "challenger": {
            "user_id": 12345,
            "username": "player1",
            "rating": 1200
        },
        "rated": true,
        "time_control": {
            "initial_seconds": 600,
            "increment_seconds": 5
        },
        "expires_in_seconds": 60
    }
}
```

#### 2.7 Challenge Response

**Client → Server (Accept)**

```json
{
    "type": "challenge_response",
    "seq": 16,
    "token": "abc123xyz789token",
    "payload": {
        "challenge_id": "challenge_123",
        "accept": true
    }
}
```

**Server → Both Players (Match Start)**

```json
{
  "type": "match_found",
  "seq": 0,
  "token": null,
  "payload": {
    "match_id": "match_abc123",
    "opponent": {...},
    "your_color": "red",
    "initial_position": "...",
    "time_control": {...}
  }
}
```

### 3. In-Game

#### 3.1 Move

**Client → Server**

```json
{
    "type": "move",
    "seq": 20,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123",
        "move_id": 1,
        "from": { "row": 9, "col": 4 },
        "to": { "row": 8, "col": 4 },
        "piece": "general",
        "capture": null,
        "notation": "帥五進一",
        "clock": {
            "red_remaining_ms": 595000,
            "black_remaining_ms": 600000
        }
    }
}
```

**Server → Opponent**

```json
{
    "type": "opponent_move",
    "seq": 0,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "move_id": 1,
        "from": { "row": 9, "col": 4 },
        "to": { "row": 8, "col": 4 },
        "piece": "general",
        "capture": null,
        "notation": "帥五進一",
        "clock": {
            "red_remaining_ms": 595000,
            "black_remaining_ms": 600000
        }
    }
}
```

**Server → Sender (Ack)**

```json
{
    "type": "move_ack",
    "seq": 20,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "move_id": 1,
        "success": true
    }
}
```

#### 3.2 Invalid Move

**Server → Client**

```json
{
    "type": "move_ack",
    "seq": 20,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "move_id": 1,
        "success": false,
        "error": "Not your turn"
    }
}
```

#### 3.3 Resign

**Client → Server**

```json
{
    "type": "resign",
    "seq": 21,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123"
    }
}
```

**Server → Both Players**

```json
{
    "type": "game_end",
    "seq": 0,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "result": "black_wins",
        "reason": "red_resigned",
        "winner_id": 67890,
        "loser_id": 12345,
        "rating_changes": {
            "12345": -15,
            "67890": +15
        }
    }
}
```

#### 3.4 Draw Offer

**Client → Server**

```json
{
    "type": "draw_offer",
    "seq": 22,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123"
    }
}
```

**Server → Opponent**

```json
{
    "type": "draw_offer_received",
    "seq": 0,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "from_user_id": 12345,
        "expires_in_seconds": 30
    }
}
```

#### 3.5 Draw Response

**Client → Server**

```json
{
    "type": "draw_response",
    "seq": 23,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123",
        "accept": true
    }
}
```

**Server → Both (if accepted)**

```json
{
    "type": "game_end",
    "seq": 0,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "result": "draw",
        "reason": "agreed_draw",
        "rating_changes": {
            "12345": 0,
            "67890": 0
        }
    }
}
```

#### 3.6 Rematch Request

**Client → Server**

```json
{
    "type": "rematch_request",
    "seq": 30,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123"
    }
}
```

**Server → Opponent**

```json
{
    "type": "rematch_offer_received",
    "seq": 0,
    "token": null,
    "payload": {
        "from_user_id": 12345,
        "previous_match_id": "match_abc123",
        "expires_in_seconds": 60
    }
}
```

### 4. Post-Game & Queries

#### 4.1 Get Match Replay

**Client → Server**

```json
{
    "type": "get_match",
    "seq": 40,
    "token": "abc123xyz789token",
    "payload": {
        "match_id": "match_abc123"
    }
}
```

**Server → Client**

```json
{
    "type": "match_data",
    "seq": 40,
    "token": null,
    "payload": {
        "match_id": "match_abc123",
        "players": {
            "red": { "user_id": 12345, "username": "player1", "rating": 1200 },
            "black": { "user_id": 67890, "username": "player2", "rating": 1250 }
        },
        "result": "black_wins",
        "moves": [
            {
                "move_id": 1,
                "color": "red",
                "from": { "row": 9, "col": 4 },
                "to": { "row": 8, "col": 4 },
                "notation": "帥五進一",
                "timestamp": "2025-10-27T10:30:15Z"
            }
            // ... more moves
        ],
        "started_at": "2025-10-27T10:30:00Z",
        "ended_at": "2025-10-27T10:45:30Z"
    }
}
```

#### 4.2 Leaderboard

**Client → Server**

```json
{
    "type": "leaderboard",
    "seq": 41,
    "token": "abc123xyz789token",
    "payload": {
        "limit": 10,
        "offset": 0
    }
}
```

**Server → Client**

```json
{
    "type": "leaderboard_response",
    "seq": 41,
    "token": null,
    "payload": {
        "players": [
            {
                "rank": 1,
                "user_id": 99999,
                "username": "grandmaster",
                "rating": 2500,
                "wins": 500,
                "losses": 50,
                "draws": 20
            }
            // ... more players
        ],
        "total_players": 1000
    }
}
```

### 5. System Messages

#### 5.1 Heartbeat

**Client → Server (every 15 seconds)**

```json
{
    "type": "heartbeat",
    "seq": 999,
    "token": "abc123xyz789token",
    "payload": {}
}
```

**Server → Client (ack)**

```json
{
    "type": "heartbeat_ack",
    "seq": 999,
    "token": null,
    "payload": {
        "server_time": "2025-10-27T10:30:00Z"
    }
}
```

#### 5.2 Error

**Server → Client**

```json
{
    "type": "error",
    "seq": 0,
    "token": null,
    "payload": {
        "error_code": "INVALID_TOKEN",
        "message": "Session expired or invalid token",
        "fatal": true
    }
}
```

#### 5.3 Server Shutdown

**Server → All Clients**

```json
{
    "type": "server_shutdown",
    "seq": 0,
    "token": null,
    "payload": {
        "message": "Server shutting down for maintenance",
        "shutdown_in_seconds": 60
    }
}
```

## 🔄 Flow Examples

### Complete Game Flow

1. **Register**

    ```
    Client → Server: {"type": "register", ...}
    Server → Client: {"type": "register_response", "success": true, ...}
    ```

2. **Login**

    ```
    Client → Server: {"type": "login", ...}
    Server → Client: {"type": "login_response", "token": "xyz", ...}
    ```

3. **Set Ready**

    ```
    Client → Server: {"type": "set_ready", "ready": true, ...}
    Server → All: {"type": "ready_list", ...}
    ```

4. **Find Match**

    ```
    Client → Server: {"type": "find_match", ...}
    [Server matches players]
    Server → Both: {"type": "match_found", ...}
    ```

5. **Play Moves**

    ```
    Client A → Server: {"type": "move", ...}
    Server → Client A: {"type": "move_ack", ...}
    Server → Client B: {"type": "opponent_move", ...}
    ```

6. **Game End**

    ```
    Client A → Server: {"type": "resign", ...}
    Server → Both: {"type": "game_end", "result": "black_wins", ...}
    ```

7. **View Leaderboard**
    ```
    Client → Server: {"type": "leaderboard", ...}
    Server → Client: {"type": "leaderboard_response", ...}
    ```

## 🛡️ Security Notes

-   All passwords MUST be hashed client-side (SHA-256 minimum)
-   Session tokens are 32-byte random hex strings
-   Server validates token on every request (except register/login)
-   Sessions expire after 24 hours of inactivity
-   Rate limiting: max 100 requests per minute per user

## 📊 Sequence Numbers

-   Client increments `seq` for each request
-   Server echoes `seq` in response
-   Server-initiated messages (broadcasts) have `seq = 0`
-   Used for request/response matching and debugging

## ⚠️ Error Handling

### Common Error Codes

-   `INVALID_TOKEN` - Session expired or invalid
-   `NOT_FOUND` - Requested resource not found
-   `ALREADY_EXISTS` - Username/email already taken
-   `INVALID_MOVE` - Illegal chess move
-   `NOT_YOUR_TURN` - Attempting to move out of turn
-   `MATCH_NOT_FOUND` - Match ID invalid
-   `TIMEOUT` - Request timed out
-   `RATE_LIMIT` - Too many requests

## 🔍 Debugging

Enable verbose logging:

```json
{
    "type": "set_debug",
    "seq": 100,
    "token": "abc123xyz789token",
    "payload": {
        "enable": true
    }
}
```

Server will then send debug events:

```json
{
  "type": "debug",
  "seq": 0,
  "token": null,
  "payload": {
    "event": "move_validated",
    "details": {...}
  }
}
```

---

**Version**: 1.0  
**Last Updated**: 2025-10-27
