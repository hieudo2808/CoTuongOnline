# 📘 TÀI LIỆU C SERVER - CỜ TƯỚNG ONLINE

**Phiên bản:** 1.0  
**Ngày cập nhật:** 8/12/2025

---

## 📑 MỤC LỤC

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Cấu Trúc Dữ Liệu](#2-cấu-trúc-dữ-liệu)
3. [Phân Tích File-by-File](#3-phân-tích-file-by-file)
4. [Application Protocol](#4-application-protocol)
5. [Thuật Toán Chính](#5-thuật-toán-chính)
6. [Tương Tác Giữa Các File](#6-tương-tác-giữa-các-file)

---

## 1. TỔNG QUAN KIẾN TRÚC

Server là một TCP server hiệu suất cao, event-driven sử dụng Linux `epoll` cho multiplexing. Triển khai:

- **Protocol JSON phân cách bởi newline** qua TCP thuần
- **Edge-triggered epoll** cho non-blocking I/O
- **Quản lý session in-memory** với token-based auth
- **Database SQL Server** qua ODBC cho lưu trữ persistent
- **Hệ thống Elo rating** cho ranked matches

### Sơ Đồ Thành Phần

```
┌─────────────────────────────────────────────────────────────┐
│                        server.c                             │
│              (epoll loop, connection handling)              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      handlers.c                             │
│          (message dispatch, 17 handler functions)           │
└──────┬──────────┬──────────┬────────────┬───────────────────┘
       │          │          │            │
       ▼          ▼          ▼            ▼
┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
│ session.c│ │ lobby.c │ │ match.c │ │   db.c   │
│ (tokens) │ │(matchmk)│ │ (games) │ │  (ODBC)  │
└──────────┘ └─────────┘ └─────────┘ └──────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  SQL Server  │
                                    │   XiangqiDB  │
                                    └──────────────┘
```

### Cổng & Kết Nối

| Thành phần | Cổng | Protocol |
|------------|------|----------|
| C Server | 8080 | TCP (JSON + newline) |
| WebSocket Bridge | 8081 | WebSocket |
| SQL Server | 1433 | TDS/ODBC |

---

## 2. CẤU TRÚC DỮ LIỆU

### 2.1 Core Structures (từ headers)

```c
// server.h - Client connection
typedef struct {
    int fd;                          // Socket file descriptor
    char recv_buffer[16384];         // Buffer nhận
    size_t recv_len;                 // Bytes trong recv buffer
    char send_buffer[16384];         // Buffer gửi
    size_t send_len;                 // Bytes trong send buffer
    size_t send_offset;              // Bytes đã gửi
    char* session_token;             // Token xác thực
    int user_id;                     // ID user đã xác thực
    bool authenticated;              // Flag xác thực
    time_t last_heartbeat;           // Thời gian hoạt động cuối
} client_t;

// server.h - Server state
typedef struct {
    int listen_fd;                   // Listening socket
    int epoll_fd;                    // epoll instance
    client_t* clients[1000];         // Mảng client
    int client_count;                // Số client active
    bool running;                    // Flag server running
} server_t;

// session.h - Session
typedef struct {
    char token[65];                  // 64 hex chars
    int user_id;
    time_t created_at;
    time_t last_activity;
} session_t;

// match.h - Move (Nước đi)
typedef struct {
    int move_id;
    char from_row, from_col;
    char to_row, to_col;
    char piece[16];                  // VD: "chariot"
    char capture[16];                // Quân bị ăn
    char notation[32];               // Ký hiệu đại số
    time_t timestamp;
    int red_time_ms, black_time_ms;
} move_t;

// match.h - Match (Trận đấu)
typedef struct {
    char match_id[32];               // "match_N_timestamp"
    int red_user_id, black_user_id;
    char current_turn[6];            // "red" hoặc "black"
    int move_count;
    move_t moves[300];
    bool rated;
    int red_time_ms, black_time_ms;
    time_t started_at, last_move_at;
    bool active;
    char result[16];                 // "red_wins", "black_wins", "draw", "ongoing"
    char end_reason[32];             // "checkmate", "resign", "timeout"
} match_t;

// lobby.h - Ready player
typedef struct {
    int user_id;
    char username[64];
    int rating;
    bool ready;
    time_t ready_since;
} lobby_player_t;

// lobby.h - Room (Phòng riêng)
typedef struct {
    char room_id[32];
    char room_code[16];              // 8 hex chars
    int host_user_id, guest_user_id;
    char password[64];
    bool rated, occupied;
    time_t created_at;
} room_t;

// lobby.h - Challenge (Thách đấu)
typedef struct {
    char challenge_id[32];
    int from_user_id, to_user_id;
    bool rated;
    int status;                      // 0=pending, 1=accepted, 2=declined
    time_t created_at, expires_at;   // Hết hạn 60s
} challenge_t;

// account.h - User
typedef struct {
    int user_id;
    char username[64];
    char email[128];
    char password_hash[65];          // SHA-256 hex
    int rating, wins, losses, draws;
    char created_at[32];
} user_t;

// protocol.h - Parsed message
typedef struct {
    char* type;                      // Loại message
    int seq;                         // Sequence number
    char* token;                     // Auth token
    char* payload_json;              // Payload dạng JSON string
} message_t;

// rating.h - Rating change
typedef struct {
    int red_change;
    int black_change;
} rating_change_t;
```

### 2.2 Giới Hạn Hệ Thống

| Hằng số | Giá trị | Mô tả |
|---------|---------|-------|
| `MAX_SESSIONS` | 1000 | Số session tối đa |
| `SESSION_TIMEOUT` | 86400 | Timeout session (24 giờ) |
| `MAX_MATCHES` | 500 | Số trận đấu tối đa |
| `MAX_MOVES_PER_MATCH` | 300 | Số nước đi tối đa/trận |
| `MAX_READY_PLAYERS` | 100 | Số player ready tối đa |
| `MAX_ROOMS` | 50 | Số phòng riêng tối đa |
| `MAX_CHALLENGES` | 100 | Số thách đấu tối đa |
| `DEFAULT_RATING` | 1200 | Rating mặc định |
| `DEFAULT_K_FACTOR` | 32 | K-factor Elo |

---

## 3. PHÂN TÍCH FILE-BY-FILE

### 3.1 `server.c` — Main Server (512 dòng)

**Mục đích:** Core server với epoll event loop, quản lý TCP socket, và vòng đời connection.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `signal_handler` | 29-33 | `int sig` | `void` | Graceful shutdown khi SIGINT/SIGTERM |
| `set_nonblocking` | 36-39 | `int fd` | `int` | Set socket O_NONBLOCK |
| `server_init` | 42-107 | `server_t*, int port` | `int` | Init socket, bind, listen, epoll |
| `client_create` | 110-120 | `int fd` | `client_t*` | Allocate client struct mới |
| `client_destroy` | 123-135 | `client_t*` | `void` | Free client, close fd |
| `client_disconnect` | 138-160 | `server_t*, client_t*` | `void` | Xóa khỏi lobby, epoll, danh sách client |
| `server_get_client_by_user_id` | 163-173 | `server_t*, int user_id` | `client_t*` | Tìm client theo user đã xác thực |
| `client_send` | 176-193 | `server_t*, client_t*, const char*` | `int` | Queue JSON message vào send buffer |
| `handle_new_connection` | 196-253 | `server_t*` | `void` | Accept loop, tạo client, thêm vào epoll |
| `handle_client_read` | 256-296 | `server_t*, client_t*` | `void` | Recv, buffer, parse messages phân cách newline |
| `handle_client_write` | 328-361 | `server_t*, client_t*` | `void` | Flush send buffer đến socket |
| `process_message` | 364-385 | `server_t*, client_t*, const char*` | `void` | Parse JSON, dispatch đến handler |
| `server_run` | 388-439 | `server_t*` | `void` | Main epoll_wait loop với periodic cleanup |
| `server_shutdown` | 442-467 | `server_t*` | `void` | Disconnect all, cleanup subsystems |
| `main` | 470-512 | `int argc, char* argv[]` | `int` | Init DB, session, lobby, match; run server |

#### Thuật Toán Chính

**Edge-triggered Epoll:**
- Sử dụng `EPOLLIN | EPOLLET` cho event handling hiệu suất cao
- Non-blocking sockets với recv/send loop

**Newline-framed Parsing:**
- Xử lý messages JSON hoàn chỉnh phân cách bởi `\n`
- Buffer accumulation cho partial reads

**Periodic Cleanup:**
- Mỗi 60s dọn dẹp sessions và challenges hết hạn

---

### 3.2 `handlers.c` — Message Handlers (1025 dòng)

**Mục đích:** 17 message handlers cho tất cả client requests.

#### Helper Functions

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `escape_json_string` | 22-56 | `const char* src, char* dst, size_t` | `void` | Escape `"`, `\`, `\n`, `\r` |
| `send_response` | 59-77 | `server_t*, client_t*, int seq, bool success, const char* msg, const char* payload` | `void` | Build và gửi JSON response |
| `validate_token_and_get_user` | 80-87 | `const char* token, int* out_user_id` | `bool` | Validate session token |

#### Handler Functions

| Handler | Dòng | Message Type | Mô tả |
|---------|------|--------------|-------|
| `handle_register` | 90-120 | `register` | Tạo tài khoản mới |
| `handle_login` | 123-175 | `login` | Xác thực, tạo session |
| `handle_logout` | 178-199 | `logout` | Hủy session, xóa khỏi lobby |
| `handle_set_ready` | 202-238 | `set_ready` | Toggle ready status trong lobby |
| `handle_find_match` | 241-395 | `find_match` | Queue matchmaking hoặc tạo match |
| `handle_move` | 398-457 | `move` | Xử lý nước cờ, relay cho đối thủ |
| `handle_resign` | 460-527 | `resign` | Kết thúc game, cập nhật Elo, lưu match |
| `handle_draw_offer` | 530-562 | `draw_offer` | Gửi đề nghị hòa cho đối thủ |
| `handle_draw_response` | 565-680 | `draw_response` | Chấp nhận/từ chối hòa |
| `handle_challenge` | 683-724 | `challenge` | Thách đấu player cụ thể |
| `handle_challenge_response` | 727-789 | `challenge_response` | Chấp nhận/từ chối thách đấu |
| `handle_get_match` | 792-815 | `get_match` | Lấy lịch sử trận từ DB |
| `handle_leaderboard` | 818-851 | `leaderboard` | Lấy top players theo rating |
| `handle_join_match` | 854-902 | `join_match` | Tham gia lại/kết nối lại trận đang có |
| `handle_heartbeat` | 905-907 | `heartbeat` | Keep-alive ping/pong |
| `handle_chat_message` | 910-985 | `chat_message` | Relay chat trong match |
| `dispatch_handler` | 988-1025 | — | Route message type đến handler |

#### Thuật Toán Chính

**Matchmaking:**
- First-come-first-served với rating tolerance tùy chọn (±200)

**Turn Validation:**
- `move_count % 2 == 0` → lượt đỏ

**Connection Verification:**
- Kiểm tra cả 2 players đã kết nối trước khi tạo match

---

### 3.3 `db.c` — Database Operations (636 dòng)

**Mục đích:** Operations SQL Server database qua ODBC.

#### Global Handles

```c
SQLHENV g_db_env = NULL;   // Environment handle
SQLHDBC g_db_conn = NULL;  // Connection handle
SQLHSTMT g_db_stmt = NULL; // Statement handle
```

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `db_print_error` | 17-29 | `SQLHANDLE, SQLSMALLINT, const char*` | `void` | In ODBC diagnostics |
| `db_init` | 32-85 | `const char* connection_string` | `bool` | Kết nối SQL Server |
| `db_shutdown` | 88-105 | `void` | `void` | Ngắt kết nối, free handles |
| `db_execute` | 108-130 | `const char* sql` | `bool` | Execute SQL tùy ý |
| `db_create_user` | 133-181 | `username, email, password_hash, *out_user_id` | `bool` | INSERT user, return SCOPE_IDENTITY |
| `db_get_user_by_username` | 184-229 | `username, *out_user_id, *out_password_hash, *out_rating` | `bool` | SELECT theo username |
| `db_get_user_by_id` | 232-287 | `user_id, *out_user` | `bool` | SELECT theo ID |
| `db_update_user_rating` | 290-325 | `user_id, new_rating` | `bool` | UPDATE rating |
| `db_update_user_stats` | 328-366 | `user_id, wins, losses, draws` | `bool` | UPDATE stats |
| `db_save_match` | 369-418 | `match_id, red_id, black_id, result, moves_json, started, ended` | `bool` | INSERT lịch sử trận |
| `db_get_match` | 421-479 | `match_id, *out_json, json_size` | `bool` | SELECT match với JOIN |
| `db_get_leaderboard` | 482-548 | `limit, offset, *out_json, json_size` | `bool` | SELECT TOP players |
| `db_check_username_exists` | 551-582 | `username` | `bool` | COUNT check |
| `db_check_email_exists` | 585-616 | `email` | `bool` | COUNT check |
| `db_get_username` | 619-636 | `user_id, *out_username, size` | `bool` | SELECT username |

#### Patterns Chính

- **Prepared statements:** Tất cả queries dùng `SQLPrepare` + `SQLBindParameter`
- **SCOPE_IDENTITY:** Dùng để lấy inserted user ID
- **Pagination:** `OFFSET/FETCH` cho leaderboard

---

### 3.4 `session.c` — Session Management (131 dòng)

**Mục đích:** Lưu trữ session in-memory với token-based.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `generate_token` | 17-23 | `char* token` | `void` | Generate token hex 64 ký tự |
| `session_init` | 26-30 | `void` | `bool` | Zero mảng, seed RNG |
| `session_create` | 33-56 | `int user_id` | `char*` | Tạo session, return token copy |
| `session_validate` | 59-80 | `const char* token, int* out_user_id` | `bool` | Check token, timeout, return user_id |
| `session_update_activity` | 83-92 | `const char* token` | `void` | Touch last_activity |
| `session_destroy` | 95-107 | `const char* token` | `void` | Xóa session |
| `session_cleanup_expired` | 110-124 | `void` | `void` | Xóa sessions timeout |
| `session_shutdown` | 127-131 | `void` | `void` | Free tất cả sessions |

---

### 3.5 `match.c` — Match/Game Management (194 dòng)

**Mục đích:** Lưu trữ active match in-memory và game state.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `match_init` | 17-22 | `void` | `bool` | Zero matches array |
| `match_shutdown` | 25 | `void` | `void` | Reset count |
| `match_create` | 28-58 | `red_id, black_id, rated, time_ms` | `char*` | Tạo match, return match_id |
| `match_get` | 61-69 | `const char* match_id` | `match_t*` | Tìm theo ID |
| `is_valid_position` | 72-74 | `int row, int col` | `bool` | Check 0-9 row, 0-8 col |
| `is_correct_turn` | 77-82 | `match_t*, int user_id` | `bool` | Check lượt qua current_turn |
| `match_validate_move` | 85-103 | `match_id, user_id, from_row/col, to_row/col` | `bool` | Kiểm tra cơ bản |
| `match_add_move` | 106-122 | `match_id, const move_t*` | `bool` | Thêm nước đi, chuyển lượt |
| `match_end` | 125-135 | `match_id, result, reason` | `bool` | Đánh dấu inactive, set result |
| `match_get_json` | 138-161 | `const char* match_id` | `char*` | Serialize to JSON |
| `match_find_by_id` | 164 | `const char* match_id` | `match_t*` | Alias cho match_get |
| `match_find_by_user` | 167-176 | `int user_id` | `match_t*` | Tìm active match theo player |
| `match_is_checkmate` | 179-184 | `match_t*` | `bool` | Stub - trả về false |
| `match_get_opponent_id` | 187-192 | `const match_t*, int user_id` | `int` | Lấy player còn lại |
| `match_get_moves_json` | 195-210 | `const match_t*` | `char*` | Serialize mảng moves |

---

### 3.6 `lobby.c` — Lobby và Matchmaking (305 dòng)

**Mục đích:** Ready list, matchmaking, rooms, và challenges.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `lobby_init` | 18-25 | `void` | `bool` | Zero tất cả arrays |
| `lobby_shutdown` | 28 | `void` | `void` | Reset count |
| `lobby_set_ready` | 31-64 | `user_id, username, rating, ready` | `void` | Thêm/cập nhật/xóa khỏi ready list |
| `lobby_remove_player` | 67-78 | `int user_id` | `void` | Xóa khỏi ready list |
| `lobby_get_ready_list_json` | 81-97 | `void` | `char*` | Serialize ready players |
| `lobby_find_random_match` | 100-112 | `user_id, *out_opponent_id` | `bool` | Đối thủ đầu tiên available |
| `lobby_find_rated_match` | 115-136 | `user_id, rating, tolerance, *out_opponent_id` | `bool` | Match tốt nhất trong tolerance |
| `lobby_create_room` | 139-161 | `host_id, room_name, password, rated` | `char*` | Tạo phòng riêng |
| `lobby_cleanup_expired_challenges` | 164-171 | `void` | `void` | Xóa challenges hết hạn |
| `lobby_join_room` | 174-202 | `room_code, password, user_id, *out_host_id` | `bool` | Vào phòng nếu available |
| `lobby_close_room` | 205-221 | `room_code, user_id` | `bool` | Host đóng phòng |
| `lobby_get_room` | 224-232 | `const char* room_code` | `room_t*` | Tìm room |
| `lobby_create_challenge` | 235-254 | `from_user_id, to_user_id, rated` | `char*` | Tạo challenge (hết hạn 60s) |
| `lobby_get_challenge` | 257-264 | `const char* challenge_id` | `challenge_t*` | Tìm challenge |
| `lobby_accept_challenge` | 267-284 | `challenge_id, user_id` | `bool` | Accept nếu là recipient |
| `lobby_decline_challenge` | 287-301 | `challenge_id, user_id` | `bool` | Decline và xóa |
| `lobby_get_ready_users` | 304-305 | `int* user_ids, int max_count` | `int` | Lấy mảng ready user IDs |

---

### 3.7 `broadcast.c` — Message Broadcasting (129 dòng)

**Mục đích:** Gửi messages đến clients cụ thể hoặc nhóm.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `send_to_client` | 16-46 | `server_t*, int client_fd, const char* message` | `bool` | Gửi trực tiếp đến fd |
| `send_to_user` | 49-73 | `server_t*, int user_id, const char* message` | `bool` | Tìm client theo user_id, gửi |
| `is_user_connected` | 76-81 | `server_t*, int user_id` | `bool` | Check user có active connection |
| `broadcast_to_match` | 84-100 | `server_t*, match_id, message` | `void` | Gửi đến cả 2 match players |
| `broadcast_to_lobby` | 103-117 | `server_t*, message` | `void` | Gửi đến tất cả ready users |
| `broadcast_to_all` | 120-129 | `server_t*, message` | `void` | Gửi đến tất cả connected clients |

---

### 3.8 `protocol.c` — Protocol Utilities (249 dòng)

**Mục đích:** JSON parsing, message creation, và framing.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `json_get_string` | 13-38 | `const char* json, const char* key` | `char*` | Extract string value (allocates) |
| `json_get_int` | 40-54 | `const char* json, const char* key` | `int` | Extract integer value |
| `json_get_bool` | 56-68 | `const char* json, const char* key` | `bool` | Extract boolean value |
| `extract_payload` | 71-95 | `const char* json` | `char*` | Extract nested payload object |
| `parse_message` | 98-117 | `const char* json` | `message_t*` | Parse thành message_t struct |
| `free_message` | 120-126 | `message_t*` | `void` | Free parsed message |
| `create_response` | 129-150 | `type, seq, token, payload_json` | `char*` | Build response JSON |
| `create_error` | 156-166 | `seq, error_code, message, fatal` | `char*` | Build error response |
| `json_escape` | 169-199 | `const char* str` | `char*` | Escape special chars |
| `extract_messages` | 202-249 | `buffer, len, ***out_messages, *count` | `int` | Split theo newlines |

---

### 3.9 `account.c` — Account Operations (139 dòng)

**Mục đích:** Đăng ký, đăng nhập, validation wrappers cho user.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `validate_username` | 16-28 | `const char* username` | `bool` | 3-20 ký tự, alphanumeric + _ |
| `validate_email` | 31-41 | `const char* email` | `bool` | Check đơn giản @ và . |
| `username_exists` | 44-46 | `const char* username` | `bool` | Wrapper cho db_check |
| `email_exists` | 48 | `const char* email` | `bool` | Wrapper cho db_check |
| `account_register` | 51-76 | `username, email, password, *out_user_id` | `bool` | Validate + tạo user |
| `account_login` | 79-100 | `username, password_hash, *out_user` | `bool` | Verify + populate user_t |
| `account_get_by_id` | 115-126 | `user_id, *out_user` | `bool` | Lấy user details |
| `account_update_rating` | 129-131 | `user_id, new_rating` | `bool` | Wrapper cho db_update |
| `account_update_stats` | 134-136 | `user_id, wins, losses, draws` | `bool` | Wrapper cho db_update |

---

### 3.10 `rating.c` — ELO Rating Calculation (42 dòng)

**Mục đích:** Triển khai hệ thống Elo rating.

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `expected_score` | 11-13 | `int rating_a, int rating_b` | `double` | $E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}$ |
| `rating_calculate` | 16-40 | `red_rating, black_rating, result, k_factor` | `rating_change_t` | Tính delta cho cả 2 players |

#### Công Thức ELO

$$\Delta R = K \times (S - E)$$

Trong đó:
- $K = 32$ (K-factor)
- $S$ = điểm thực tế (1.0 thắng, 0.5 hòa, 0.0 thua)
- $E$ = điểm kỳ vọng

---

## 4. APPLICATION PROTOCOL

### 4.1 Message Format

Tất cả messages là **JSON phân cách bởi newline** (kết thúc `\n`).

#### Format Request

```json
{
  "type": "<message_type>",
  "seq": <sequence_number>,
  "token": "<session_token>",
  "payload": { ... }
}
```

#### Format Response

```json
{
  "type": "response" | "error",
  "seq": <sequence_number>,
  "success": true | false,
  "message": "<human_readable>",
  "payload": { ... }
}
```

#### Format Event (Server Push)

```json
{
  "type": "<event_type>",
  "payload": { ... }
}
```

---

### 4.2 Request/Response Messages

#### `register` - Đăng Ký

**Request:**
```json
{
  "type": "register",
  "seq": 1,
  "payload": {
    "username": "player1",
    "email": "player1@example.com",
    "password": "hashed_password"
  }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 1,
  "success": true,
  "message": "Registration successful",
  "payload": { "user_id": 123, "username": "player1" }
}
```

---

#### `login` - Đăng Nhập

**Request:**
```json
{
  "type": "login",
  "seq": 2,
  "payload": {
    "username": "player1",
    "password": "hashed_password"
  }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 2,
  "success": true,
  "message": "Login successful",
  "payload": {
    "token": "abc123...",
    "user_id": 123,
    "username": "player1",
    "rating": 1200
  }
}
```

---

#### `logout` - Đăng Xuất

**Request:**
```json
{
  "type": "logout",
  "seq": 3,
  "token": "abc123..."
}
```

---

#### `set_ready` - Set Trạng Thái Sẵn Sàng

**Request:**
```json
{
  "type": "set_ready",
  "seq": 4,
  "token": "abc123...",
  "payload": { "ready": true }
}
```

---

#### `find_match` - Tìm Trận

**Request:**
```json
{
  "type": "find_match",
  "seq": 5,
  "token": "abc123...",
  "payload": { "mode": "random" | "rated" }
}
```

**Response (đang đợi):**
```json
{
  "type": "response",
  "seq": 5,
  "success": true,
  "message": "Queued for match",
  "payload": { "status": "queued" }
}
```

**Response (tìm thấy ngay):**
```json
{
  "type": "response",
  "seq": 5,
  "success": true,
  "message": "Match found",
  "payload": {
    "match_id": "match_1_1702000000",
    "red_user": "player1",
    "black_user": "player2",
    "your_color": "red"
  }
}
```

---

#### `move` - Đi Quân

**Request:**
```json
{
  "type": "move",
  "seq": 6,
  "token": "abc123...",
  "payload": {
    "match_id": "match_1_...",
    "from_row": 0,
    "from_col": 0,
    "to_row": 2,
    "to_col": 0
  }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 6,
  "success": true,
  "message": "Move accepted"
}
```

---

#### `resign` - Đầu Hàng

**Request:**
```json
{
  "type": "resign",
  "seq": 7,
  "token": "abc123...",
  "payload": { "match_id": "match_1_..." }
}
```

---

#### `draw_offer` - Đề Nghị Hòa

**Request:**
```json
{
  "type": "draw_offer",
  "seq": 8,
  "token": "abc123...",
  "payload": { "match_id": "match_1_..." }
}
```

---

#### `draw_response` - Phản Hồi Đề Nghị Hòa

**Request:**
```json
{
  "type": "draw_response",
  "seq": 9,
  "token": "abc123...",
  "payload": {
    "match_id": "match_1_...",
    "accept": true | false
  }
}
```

---

#### `challenge` - Thách Đấu

**Request:**
```json
{
  "type": "challenge",
  "seq": 10,
  "token": "abc123...",
  "payload": {
    "opponent_id": 456,
    "rated": true
  }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 10,
  "success": true,
  "message": "Challenge sent",
  "payload": { "challenge_id": "ch_0_1702000000" }
}
```

---

#### `challenge_response` - Phản Hồi Thách Đấu

**Request:**
```json
{
  "type": "challenge_response",
  "seq": 11,
  "token": "abc123...",
  "payload": {
    "challenge_id": "ch_0_...",
    "accept": true | false
  }
}
```

---

#### `get_match` - Lấy Thông Tin Trận

**Request:**
```json
{
  "type": "get_match",
  "seq": 12,
  "token": "abc123...",
  "payload": { "match_id": "match_1_..." }
}
```

---

#### `join_match` - Tham Gia Lại Trận

**Request:**
```json
{
  "type": "join_match",
  "seq": 13,
  "token": "abc123...",
  "payload": { "match_id": "match_1_..." }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 13,
  "success": true,
  "message": "Joined match",
  "payload": {
    "match_id": "match_1_...",
    "move_count": 5,
    "current_turn": "black",
    "is_my_turn": true
  }
}
```

---

#### `leaderboard` - Bảng Xếp Hạng

**Request:**
```json
{
  "type": "leaderboard",
  "seq": 14,
  "token": "abc123...",
  "payload": { "limit": 10, "offset": 0 }
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 14,
  "success": true,
  "message": "Leaderboard",
  "payload": [
    { "username": "player1", "rating": 1500, "wins": 10, "losses": 5, "draws": 2 },
    ...
  ]
}
```

---

#### `heartbeat` - Keep-Alive

**Request:**
```json
{
  "type": "heartbeat",
  "seq": 15,
  "payload": {}
}
```

**Response:**
```json
{
  "type": "response",
  "seq": 15,
  "success": true,
  "message": "pong"
}
```

---

#### `chat_message` - Chat

**Request:**
```json
{
  "type": "chat_message",
  "seq": 16,
  "payload": {
    "token": "abc123...",
    "match_id": "match_1_...",
    "message": "Good luck!"
  }
}
```

---

### 4.3 Server Push Events

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `ready_list_update` | Player join/leave ready | `[ { user_id, username, rating } ]` |
| `match_found` | Match được tạo | `{ match_id, red_user, black_user, your_color }` |
| `opponent_move` | Đối thủ đi quân | `{ match_id, from: {row,col}, to: {row,col} }` |
| `game_end` | Game kết thúc | `{ match_id, result, red_rating, black_rating }` |
| `draw_offer` | Đối thủ đề nghị hòa | `{ match_id }` |
| `challenge_received` | Nhận thách đấu trực tiếp | `{ challenge_id, from_user_id, rated }` |
| `match_start` | Thách đấu được chấp nhận | `{ match_id }` |
| `chat_message` | Chat trong match | `{ match_id, user_id, username, message, timestamp }` |

---

## 5. THUẬT TOÁN CHÍNH

### 5.1 Matchmaking Algorithm

```
handle_find_match(user_id, mode):
    1. Validate token
    2. if mode == "random":
           opponent = lobby_find_random_match(user_id)
       else if mode == "rated":
           opponent = lobby_find_rated_match(user_id, rating, ±200)
    
    3. if opponent found AND is_user_connected(opponent):
           match_id = match_create(user_id, opponent, rated)
           lobby_remove_player(user_id)
           lobby_remove_player(opponent)
           
           // Gửi match_found cho cả 2
           send_to_user(user_id, match_found{color: random})
           send_to_user(opponent, match_found{color: other})
       else:
           // Thêm vào queue chờ
           lobby_set_ready(user_id, true)
           respond("Queued for match")
```

### 5.2 ELO Rating Algorithm

```c
double expected_score(int rating_a, int rating_b) {
    return 1.0 / (1.0 + pow(10.0, (rating_b - rating_a) / 400.0));
}

rating_change_t rating_calculate(int red_rating, int black_rating, 
                                  const char* result, int k_factor) {
    double red_expected = expected_score(red_rating, black_rating);
    double black_expected = 1.0 - red_expected;
    
    double red_actual, black_actual;
    if (strcmp(result, "red_wins") == 0) {
        red_actual = 1.0; black_actual = 0.0;
    } else if (strcmp(result, "black_wins") == 0) {
        red_actual = 0.0; black_actual = 1.0;
    } else {  // draw
        red_actual = 0.5; black_actual = 0.5;
    }
    
    return {
        .red_change = (int)round(k_factor * (red_actual - red_expected)),
        .black_change = (int)round(k_factor * (black_actual - black_expected))
    };
}
```

### 5.3 Session Token Generation

```c
void generate_token(char* token) {
    for (int i = 0; i < 64; i += 2) {
        sprintf(token + i, "%02x", rand() % 256);
    }
    token[64] = '\0';
}
```

### 5.4 JSON Parsing (Manual)

```c
char* json_get_string(const char* json, const char* key) {
    // Tìm "key":
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);
    
    char* start = strstr(json, pattern);
    if (!start) return NULL;
    
    start += strlen(pattern);
    // Skip whitespace
    while (*start == ' ' || *start == '\t') start++;
    
    if (*start == '"') {
        // String value
        start++;
        char* end = strchr(start, '"');
        // Handle escaped quotes
        while (end && *(end-1) == '\\') {
            end = strchr(end + 1, '"');
        }
        if (end) {
            size_t len = end - start;
            char* result = malloc(len + 1);
            strncpy(result, start, len);
            result[len] = '\0';
            return result;
        }
    }
    return NULL;
}
```

---

## 6. TƯƠNG TÁC GIỮA CÁC FILE

### 6.1 Dependency Graph

```
server.c ──┬── handlers.c ──┬── session.c
           │                ├── lobby.c
           │                ├── match.c
           │                ├── db.c
           │                ├── broadcast.c
           │                ├── protocol.c
           │                ├── account.c
           │                └── rating.c
           │
           ├── session.c (cleanup)
           ├── lobby.c (cleanup)
           ├── match.c (shutdown)
           └── db.c (shutdown)
```

### 6.2 Data Flow

**1. Connection → Authentication:**
```
server.c (accept) → handlers.c (handle_login) → 
db.c (verify) → session.c (create) → client.authenticated = true
```

**2. Matchmaking:**
```
handlers.c (handle_find_match) → lobby.c (find_random_match) →
match.c (match_create) → broadcast.c (send_to_user) → both clients
```

**3. Game Move:**
```
handlers.c (handle_move) → match.c (match_add_move) →
broadcast.c (send_to_user) → opponent only
```

**4. Game End:**
```
handlers.c (handle_resign/draw) → match.c (match_end) →
rating.c (calculate) → db.c (update rating/stats/save match) →
broadcast.c (broadcast_to_match) → both clients
```

---

## 📊 THỐNG KÊ

| Thể loại | Số lượng |
|----------|----------|
| Tổng file C (server) | 10 |
| Tổng dòng code C (server) | ~3,700 |
| Message handlers | 17 |
| Database operations | 12 |
| In-memory structures | 4 (sessions, matches, lobby, rooms) |

---

**Kết thúc tài liệu C Server**
