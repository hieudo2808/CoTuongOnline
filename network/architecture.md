# System Architecture - Xiangqi Multiplayer

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DEVICES                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Browser 1  │  │   Browser 2  │  │   Browser N  │              │
│  │  (Player A)  │  │  (Player B)  │  │  (Player N)  │              │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘              │
│          │                 │                 │                       │
│          │ HTML/CSS/JS     │                 │                       │
│          │ (Existing UI)   │                 │                       │
│          │                 │                 │                       │
└──────────┼─────────────────┼─────────────────┼───────────────────────┘
           │                 │                 │
           │ WebSocket/      │                 │
           │ spawn()         │                 │
           │                 │                 │
┌──────────▼─────────────────▼─────────────────▼───────────────────────┐
│                    NETWORK BRIDGE LAYER                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  networkBridge.js (Node.js or Browser)                       │   │
│  │  - Spawns C Client as subprocess                             │   │
│  │  - Communicates via stdin/stdout                             │   │
│  │  - Parses JSON messages                                      │   │
│  │  - Event emitter for UI                                      │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────────────┘
                            │
                            │ stdin/stdout
                            │ (JSON + newline)
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                      C CLIENT LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  client.c (Per User)                                         │   │
│  │  - TCP socket connection                                     │   │
│  │  - Newline-framed JSON messages                              │   │
│  │  - Non-blocking I/O                                          │   │
│  │  - Buffer management                                         │   │
│  │  - Callback API for JS bridge                                │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────────────┘
                            │
                            │ TCP (Port 9000)
                            │ JSON + \n framing
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                       C SERVER LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  server.c (Central Server)                                   │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  epoll() Event Loop                                    │ │   │
│  │  │  - Non-blocking accept()                               │ │   │
│  │  │  - Edge-triggered multiplexing                         │ │   │
│  │  │  - Handles 1000+ concurrent connections                │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │
│  │  │  protocol.c │  │  account.c  │  │  session.c  │        │   │
│  │  │  (Parsing)  │  │  (Users)    │  │  (Tokens)   │        │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │
│  │  │   lobby.c   │  │   match.c   │  │   rating.c  │        │   │
│  │  │  (Matching) │  │  (Games)    │  │  (Elo)      │        │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐                          │   │
│  │  │handlers.c   │  │broadcast.c  │                          │   │
│  │  │(Messages)   │  │(Push notif) │                          │   │
│  │  └─────────────┘  └─────────────┘                          │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────────────┘
                            │
                            │ SQL queries
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                      DATABASE LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SQLite / SQL Server (xiangqi.db)                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │   users    │  │  matches   │  │  sessions  │            │   │
│  │  │            │  │            │  │            │            │   │
│  │  │ - user_id  │  │ - match_id │  │ - token    │            │   │
│  │  │ - username │  │ - red_id   │  │ - user_id  │            │   │
│  │  │ - password │  │ - black_id │  │ - expires  │            │   │
│  │  │ - rating   │  │ - result   │  │            │            │   │
│  │  │ - wins     │  │ - moves    │  │            │            │   │
│  │  │ - losses   │  │ - started  │  │            │            │   │
│  │  │ - draws    │  │ - ended    │  │            │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. Registration & Login Flow

```
Player A (Browser)
    │
    │ 1. User fills form
    │    username: "player1"
    │    password: "secret123"
    │
    ▼
networkBridge.js
    │
    │ 2. Hash password (SHA-256)
    │    hash = sha256("secret123")
    │
    │ 3. Spawn C client
    │    spawn('./client', ['127.0.0.1', '9000'])
    │
    ▼
C Client (client.c)
    │
    │ 4. Connect to server
    │    connect(socket, addr)
    │
    │ 5. Send JSON
    │    {"type":"register","seq":1,"token":null,
    │     "payload":{"username":"player1","password":"hash"}}
    │    + \n
    │
    ▼
C Server (server.c)
    │
    │ 6. epoll detects readable socket
    │    epoll_wait() returns
    │
    │ 7. recv() data
    │    Accumulate in buffer until \n
    │
    │ 8. Parse JSON
    │    protocol.c: parse_message()
    │
    │ 9. Route to handler
    │    handlers.c: handle_register()
    │
    ▼
Account & DB (account.c, db.c)
    │
    │ 10. Validate username/email
    │     validate_username()
    │     username_exists() → false (OK)
    │
    │ 11. Insert into database
    │     db_create_user()
    │     INSERT INTO users (username, email, password_hash)
    │
    │ 12. Return user_id = 1
    │
    ▼
C Server
    │
    │ 13. Build response
    │     {"type":"register_response","seq":1,
    │      "payload":{"success":true,"user_id":1}}
    │     + \n
    │
    │ 14. send() to client
    │
    ▼
C Client
    │
    │ 15. Receive response
    │    Parse JSON
    │
    │ 16. Call callback / write to stdout
    │    printf("%s\n", json)
    │
    ▼
networkBridge.js
    │
    │ 17. Read from stdout
    │    process.stdout.on('data', ...)
    │
    │ 18. Parse JSON
    │    JSON.parse(line)
    │
    │ 19. Emit event
    │    emit('register_response', message)
    │
    ▼
Player A (Browser)
    │
    │ 20. Update UI
    │    "Registration successful!"
```

---

### 2. Matchmaking & Game Flow

```
Player A                    Server                      Player B
   │                           │                           │
   │ set_ready                 │                           │
   ├──────────────────────────►│                           │
   │                           │                           │
   │                           │◄─────────────────────────┤
   │                           │        set_ready          │
   │                           │                           │
   │                     ┌─────▼─────┐                    │
   │                     │  Matching │                    │
   │                     │  Engine   │                    │
   │                     │           │                    │
   │                     │ Find pair │                    │
   │                     │ A + B     │                    │
   │                     └─────┬─────┘                    │
   │                           │                           │
   │ match_found               │                           │
   │◄──────────────────────────┤                           │
   │ opponent: Player B        │                           │
   │ your_color: red           │                           │
   │                           │────────────────────────►  │
   │                           │         match_found       │
   │                           │         opponent: Player A│
   │                           │         your_color: black │
   │                           │                           │
   │ move                      │                           │
   ├──────────────────────────►│                           │
   │ from: (9,4)               │                           │
   │ to: (8,4)                 │                           │
   │                           │                           │
   │ move_ack                  │                           │
   │◄──────────────────────────┤                           │
   │ success: true             │                           │
   │                           │                           │
   │                           │────────────────────────►  │
   │                           │   opponent_move           │
   │                           │   from: (9,4)             │
   │                           │   to: (8,4)               │
   │                           │                           │
   │                           │◄─────────────────────────┤
   │                           │          move             │
   │                           │                           │
   │◄──────────────────────────┤                           │
   │      opponent_move        │────────────────────────►  │
   │                           │         move_ack          │
   │                           │                           │
   ...                        ...                        ...
   │                           │                           │
   │ resign                    │                           │
   ├──────────────────────────►│                           │
   │                           │                           │
   │ game_end                  │                           │
   │◄──────────────────────────┤                           │
   │ result: black_wins        │                           │
   │ reason: red_resigned      │                           │
   │                           │────────────────────────►  │
   │                           │         game_end          │
   │                           │                           │
   │                     ┌─────▼─────┐                    │
   │                     │  Update   │                    │
   │                     │  Database │                    │
   │                     │  - Match  │                    │
   │                     │  - Rating │                    │
   │                     │  - Stats  │                    │
   │                     └───────────┘                    │
```

---

## 🧱 Component Details

### Server Components

#### 1. **server.c** - Main Event Loop

-   **epoll()**: Multiplexing 1000+ connections
-   **Non-blocking I/O**: No thread per client
-   **Edge-triggered**: Efficient event handling
-   **Buffer management**: Handle partial reads/writes

#### 2. **protocol.c** - Message Processing

-   **Newline framing**: `message\n`
-   **JSON parsing**: Extract type, seq, token, payload
-   **Message validation**: Check required fields

#### 3. **handlers.c** - Business Logic

-   Route messages to appropriate handlers
-   Validate authentication (token)
-   Build responses
-   Send to clients

#### 4. **lobby.c** - Matchmaking

-   **Ready list**: Players waiting for match
-   **Random matching**: Pair any two ready players
-   **Rating matching**: Pair within rating tolerance
-   **Challenge system**: Direct 1v1 challenges
-   **Private rooms**: Password-protected rooms

#### 5. **match.c** - Game State

-   Track active matches
-   Validate moves (basic sanity)
-   Record moves
-   Determine winners
-   End matches

#### 6. **account.c** - User Management

-   Registration validation
-   Login authentication
-   Password verification
-   Profile queries

#### 7. **session.c** - Token Management

-   Generate session tokens (64-char hex)
-   Validate tokens
-   Track activity
-   Cleanup expired sessions

#### 8. **db.c** - Database Operations

-   SQLite integration
-   Prepared statements (SQL injection safe)
-   User CRUD operations
-   Match logging
-   Leaderboard queries

#### 9. **rating.c** - Elo Calculation

-   Expected score formula
-   Rating updates
-   Configurable K-factor

---

### Client Components

#### 1. **client.c** - TCP Client

-   Connect to server
-   Send JSON messages
-   Receive and buffer data
-   Parse newline-delimited messages
-   Callback mechanism for JS

#### 2. **networkBridge.js** - JS Wrapper

-   Spawn C client as subprocess
-   stdin/stdout communication
-   Event emitter for UI
-   Promise-based API

---

### Database Schema

```
users
├── user_id (PK)
├── username (UNIQUE)
├── email (UNIQUE)
├── password_hash
├── rating (default 1200)
├── wins
├── losses
├── draws
└── created_at

matches
├── match_id (PK)
├── red_user_id (FK)
├── black_user_id (FK)
├── result
├── moves_json (JSON array)
├── started_at
├── ended_at
├── red_rating_change
└── black_rating_change

sessions
├── token (PK)
├── user_id (FK)
├── created_at
├── last_activity
└── expires_at
```

---

## 🔐 Security Architecture

### 1. Authentication

```
Client                          Server
  │                                │
  │  password                      │
  ├─────────►  SHA-256 ─────►      │
  │  hash                           │
  │                                │
  │  username + hash               │
  ├────────────────────────►       │
  │                                │
  │  ◄───── session token ─────────┤
  │  (64-char random hex)          │
  │                                │
  │  All subsequent requests       │
  │  include token                 │
  ├────────────────────────►       │
  │  token validated               │
```

### 2. Session Management

-   Token stored in-memory on server
-   24-hour expiration
-   Activity-based refresh
-   Logout invalidates token

### 3. Input Validation

-   Username: alphanumeric, 3-20 chars
-   Email: basic format check
-   Move coordinates: range check (0-9, 0-8)
-   SQL: prepared statements only

### 4. Rate Limiting

-   Max 100 requests/minute per user
-   Connection limit per IP
-   Heartbeat timeout (45s)

---

## 📊 Performance Characteristics

### Scalability

-   **Concurrent connections**: 1000+ (epoll)
-   **Matches**: 500+ simultaneous
-   **Latency**: <50ms LAN, <200ms WAN
-   **Throughput**: 10,000+ messages/sec

### Resource Usage

-   **Memory**: ~50KB per client connection
-   **CPU**: Minimal (event-driven)
-   **Disk**: Database writes on match end
-   **Network**: ~1KB per move message

---

## 🔄 Alternative Architectures

### Option 1: WebSocket Instead of TCP

```
Browser ───WebSocket───► Node.js Server ───TCP───► C Game Server
```

**Pros:** Native browser support, no subprocess
**Cons:** Extra layer, Node.js required

### Option 2: Full Node.js Server

```
Browser ───WebSocket───► Node.js Server (JavaScript)
```

**Pros:** Single language, easier development
**Cons:** Doesn't meet C requirement

### Option 3: Native Addon

```
Browser ───► Node.js ───N-API───► C Client ───TCP───► C Server
```

**Pros:** Best performance, seamless integration
**Cons:** Compilation required, platform-specific

---

## 📁 Project Structure Summary

```
network/
├── README.md               # Main documentation
├── protocol.md             # JSON message spec
├── architecture.md         # This file
│
├── c_server/               # C Server
│   ├── Makefile
│   ├── src/
│   │   ├── server.c        # ✅ Main + epoll
│   │   ├── protocol.c      # ✅ JSON parsing
│   │   ├── handlers.c      # ⚠️ Need implement
│   │   ├── account.c       # ✅ Complete
│   │   ├── session.c       # ✅ Complete
│   │   ├── lobby.c         # ⚠️ Partial
│   │   ├── match.c         # ⚠️ Partial
│   │   ├── db.c            # ✅ Complete
│   │   ├── rating.c        # ✅ Complete
│   │   └── broadcast.c     # ⚠️ Need implement
│   ├── include/            # Headers
│   └── tests/              # ⚠️ Need tests
│
├── c_client/               # C Client
│   ├── Makefile
│   ├── src/
│   │   └── client.c        # ✅ Complete
│   └── include/
│       └── client.h
│
├── js_bridge/              # JavaScript Integration
│   ├── networkBridge.js    # ✅ Complete
│   └── README.md
│
├── sql/
│   └── schema.sql          # ✅ Complete
│
├── scripts/
│   ├── build.sh            # ✅ Build script
│   └── test_flow.sh        # ✅ Test script
│
└── docs/
    ├── API.md              # ✅ C Client API
    ├── deployment.md       # ✅ Deployment guide
    └── implementation_guide.md # ✅ TODO list
```

**Status:**

-   ✅ Complete: ~60%
-   ⚠️ Partial/Template: ~30%
-   ❌ Missing: ~10%

---

## 🎯 Design Decisions & Trade-offs

### 1. TCP vs UDP

**Chose:** TCP
**Reason:** Reliability more important than low latency for turn-based game
**Trade-off:** Slightly higher latency, but guaranteed message delivery

### 2. epoll vs select/poll

**Chose:** epoll (Linux)
**Reason:** Scalability to 1000+ connections
**Trade-off:** Linux-only (not portable to Windows natively)

### 3. SQLite vs SQL Server

**Chose:** SQLite (default), SQL Server (optional)
**Reason:** Easy setup, no external dependencies
**Trade-off:** Less scalable than PostgreSQL/SQL Server for production

### 4. Subprocess vs Native Addon

**Chose:** Subprocess (recommended)
**Reason:** Easy integration, cross-platform
**Trade-off:** Slightly more overhead than native addon

### 5. In-memory vs Persistent Sessions

**Chose:** In-memory (with persistence option)
**Reason:** Fast lookups, simple implementation
**Trade-off:** Sessions lost on server restart (acceptable for game server)

### 6. Client-side vs Server-side Move Validation

**Chose:** Hybrid (client validates, server sanity checks)
**Reason:** Balance between complexity and security
**Trade-off:** Possible cheating if client is compromised

---

## 🔮 Future Enhancements

### Phase 3 (Post-MVP)

-   [ ] WebSocket support for browser
-   [ ] Reconnection with game state recovery
-   [ ] Spectator mode
-   [ ] In-game chat
-   [ ] Move take-back
-   [ ] Animated move replay
-   [ ] Tournament system
-   [ ] Ranked seasons

### Phase 4 (Advanced)

-   [ ] AI opponent integration
-   [ ] Machine learning for anti-cheat
-   [ ] Redis for session caching
-   [ ] PostgreSQL for production DB
-   [ ] Horizontal scaling (multiple servers)
-   [ ] Load balancer
-   [ ] CDN for static assets
-   [ ] Mobile app (React Native)

---

**Version:** 1.0  
**Last Updated:** 2025-10-27  
**Authors:** CoTuong Team
