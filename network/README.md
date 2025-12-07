# Xiangqi Multiplayer Networking System

## 🎯 Mục tiêu

Hệ thống multiplayer cho game Cờ Tướng với C Server + C Client + JavaScript Integration.

## 🏗️ Kiến trúc

```
Browser (JS)
    ↓ (WebSocket or stdin/stdout)
C Client (client.c)
    ↓ (TCP + JSON newline-framed)
C Server (server.c + epoll)
    ↓
SQL Server Database
```

## 📁 Cấu trúc

```
network/
├── README.md              # Tài liệu này
├── protocol.md            # Chi tiết giao thức JSON
├── architecture.md        # Sơ đồ kiến trúc
│
├── c_server/              # Server C
│   ├── Makefile
│   ├── src/
│   │   ├── server.c       # Main server + epoll
│   │   ├── protocol.c     # JSON parsing/framing
│   │   ├── account.c      # User registration/login
│   │   ├── session.c      # Session management
│   │   ├── lobby.c        # Lobby + matchmaking
│   │   ├── match.c        # Game match handling
│   │   ├── db.c           # SQL Server connection
│   │   ├── game_logic.c   # Game validation
│   │   ├── rating.c       # Elo rating system
│   │   └── utils.c        # Utilities
│   │
│   ├── include/
│   │   └── *.h            # Headers
│   │
│   └── tests/
│       └── test_*.c       # Test cases
│
├── c_client/              # Client C
│   ├── Makefile
│   ├── src/
│   │   ├── client.c       # Main client
│   │   ├── protocol.c     # Shared protocol
│   │   ├── connection.c   # Connection management
│   │   └── api.c          # API for JS integration
│   │
│   ├── include/
│   │   └── *.h
│   │
│   └── tests/
│       └── test_*.c
│
├── js_bridge/             # JavaScript Integration
│   ├── networkBridge.js   # Main bridge
│   ├── clientAdapter.js   # C Client adapter
│   └── gameNetworkController.js  # Network game controller
│
├── sql/                   # Database
│   ├── schema.sql         # DB schema
│   └── seed.sql           # Sample data
│
├── scripts/               # Build & test scripts
│   ├── build.sh
│   ├── test_flow.sh       # Integration test
│   └── setup_db.sh
│
└── docs/
    ├── API.md             # C Client API spec
    ├── deployment.md      # Deployment guide
    └── security.md        # Security considerations
```

## 🚀 Quick Start

### 1. Build Server

```bash
cd network/c_server
make
./bin/server 9000
```

### 2. Build Client

```bash
cd network/c_client
make
./bin/client 127.0.0.1 9000
```

### 3. Setup Database

```bash
cd network/scripts
./setup_db.sh
```

### 4. Run Integration Test

```bash
cd network/scripts
./test_flow.sh
```

## 🔧 Yêu cầu hệ thống

-   **OS**: Linux (Ubuntu 20.04+) hoặc WSL2 trên Windows
-   **Compiler**: GCC 9.0+
-   **Database**: SQL Server 2019+ hoặc SQLite (fallback)
-   **Libraries**:
    -   JSON parsing: cJSON (included)
    -   SQL: ODBC driver hoặc SQLite3
    -   Build tools: make, pkg-config

### Cài đặt dependencies (Ubuntu)

```bash
sudo apt update
sudo apt install -y build-essential
sudo apt install -y libsqlite3-dev  # SQLite (hoặc SQL Server ODBC)
sudo apt install -y pkg-config
```

## 📋 Checklist tính năng

### I. Networking & Streams (3 điểm)

-   [x] Stream handling with non-blocking recv
-   [x] Newline-based framing
-   [x] Buffer accumulation & partial reads
-   [x] Backpressure handling
-   [x] Server socket with epoll multiplexing
-   [x] Handle slow clients without blocking

### II. User Management (4 điểm)

-   [x] Registration with username/email validation
-   [x] Password hashing (SHA-256 minimum)
-   [x] Login with session token
-   [x] Session timeout & logout
-   [x] Persistent sessions in DB

### III. Lobby & Matching (7 điểm)

-   [x] Ready list broadcast
-   [x] Random matchmaking
-   [x] Rating-based matchmaking (Elo)
-   [x] Private room creation
-   [x] Challenge user
-   [x] Accept/Decline challenge
-   [x] Timeout handling

### IV. In-game Handling (6–8 điểm)

-   [x] Move transmission with ack
-   [x] Move legality validation (turn + sanity)
-   [x] Game result determination
-   [x] Resign/Draw offer
-   [x] Rematch request

### V. Post-game (5 điểm)

-   [x] Match logging (moves + timestamps)
-   [x] Send result to clients
-   [x] Store match data
-   [x] Replay API (get_match/{id})
-   [x] Replay JSON for JS consumption

### VI. Scoring & Ranking (2–4 điểm)

-   [x] Elo rating implementation
-   [x] Configurable K-factor
-   [x] Leaderboard API with caching
-   [x] Top players query

### VII. UI Integration (3 điểm)

-   [x] C Client API for JS
-   [x] Callback mechanism
-   [x] WebSocket adapter
-   [x] Integration example

### VIII. Advanced (bonus)

-   [ ] In-game chat
-   [ ] Reconnection support
-   [ ] Spectator mode
-   [ ] Rate limiting
-   [ ] Anti-cheat heuristics

## 📡 Giao thức

### Message Format

```json
{
    "type": "register|login|ready|move|challenge|...",
    "seq": 1234,
    "token": "session-token-here",
    "payload": {
        /* type-specific */
    }
}
```

Mỗi message kết thúc bằng `\n` (newline).

### Example Messages

Xem chi tiết trong `protocol.md`.

## 🧪 Testing

### Unit Tests

```bash
cd network/c_server
make test
./bin/test_protocol
./bin/test_db
```

### Integration Test

```bash
cd network/scripts
./test_flow.sh
```

Kịch bản test:

1. 2 clients đăng ký
2. Login
3. Set ready
4. Match được tạo
5. Chơi 5 nước
6. Client 1 resign
7. Kết quả được broadcast
8. Leaderboard update

## 🌐 Deployment

### Local Testing

```bash
./server 9000
# Server listening on 0.0.0.0:9000
```

### Public Deployment

Xem `docs/deployment.md` cho:

-   Port forwarding setup
-   Firewall configuration
-   Security considerations
-   Public IP detection

## 🔒 Security

-   **Passwords**: SHA-256 hashing (nên dùng Argon2/bcrypt cho production)
-   **Session tokens**: Cryptographically secure random
-   **SQL Injection**: Parameterized queries
-   **Rate limiting**: Basic implementation
-   **Input validation**: All user inputs

Xem `docs/security.md` cho chi tiết.

## 📊 Performance

-   **epoll**: Xử lý 1000+ concurrent connections
-   **Non-blocking I/O**: Không block server
-   **Buffer pool**: Tái sử dụng buffer
-   **Leaderboard cache**: Cache 5 phút

## 🤝 Integration với JS UI

### Option 1: Subprocess + stdin/stdout (Recommended)

```javascript
// JS spawns C client as subprocess
const client = spawn('./network/c_client/bin/client', ['127.0.0.1', '9000']);

client.stdout.on('data', (data) => {
  const messages = data.toString().split('\n');
  messages.forEach(msg => {
    if (msg) handleMessage(JSON.parse(msg));
  });
});

client.stdin.write(JSON.stringify({type: 'login', ...}) + '\n');
```

### Option 2: Native Addon (N-API)

Xem `docs/API.md` cho wrapper N-API.

### Option 3: WebSocket Bridge

C client → WebSocket server → Browser
(Template provided)

## 📚 Documentation

-   `protocol.md` - JSON message protocol
-   `architecture.md` - System architecture
-   `docs/API.md` - C Client API reference
-   `docs/deployment.md` - Deployment guide
-   `docs/security.md` - Security best practices

## 🐛 Troubleshooting

### Server không start

```bash
# Check port đã được dùng chưa
netstat -tuln | grep 9000
# Kill process nếu cần
pkill -9 server
```

### Client không kết nối được

```bash
# Test TCP connection
telnet 127.0.0.1 9000
# Check firewall
sudo ufw status
```

### Database connection failed

```bash
# SQLite: check file permissions
ls -la network/sql/xiangqi.db
# SQL Server: check ODBC config
odbcinst -q -d
```

## 📝 License

Open Source - Educational Project

## 👥 Contributors

CoTuong Team - Network Engineering Course

---

**Để bắt đầu, chạy:**

```bash
cd network/scripts
./build.sh && ./test_flow.sh
```
