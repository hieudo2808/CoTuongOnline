# 📘 LUỒNG HỆ THỐNG VÀ THUẬT TOÁN (SYSTEM FLOW & ALGORITHMS)

**Phiên bản:** 1.0  
**Ngày cập nhật:** 8/12/2025

---

## 📑 MỤC LỤC

1. [Kiến Trúc Tổng Thể](#1-kiến-trúc-tổng-thể)
2. [Luồng Kết Nối](#2-luồng-kết-nối)
3. [Luồng Xác Thực](#3-luồng-xác-thực)
4. [Luồng Matchmaking](#4-luồng-matchmaking)
5. [Luồng Game](#5-luồng-game)
6. [Thuật Toán Cờ Tướng](#6-thuật-toán-cờ-tướng)
7. [Thuật Toán Elo Rating](#7-thuật-toán-elo-rating)
8. [Xử Lý Lỗi và Recovery](#8-xử-lý-lỗi-và-recovery)

---

## 1. KIẾN TRÚC TỔNG THỂ

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (Browsers)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Player 1   │  │  Player 2   │  │  Player 3   │  │  Player N   │        │
│  │  (Browser)  │  │  (Browser)  │  │  (Browser)  │  │  (Browser)  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │ WebSocket      │ WebSocket      │ WebSocket      │ WebSocket
          │ (ws://8081)    │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WebSocket Bridge (Node.js)                          │
│                              ws-bridge.js                                    │
│                                Port: 8081                                    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ TCP (newline-delimited JSON)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              C Server (epoll)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           server.c (Main Loop)                          ││
│  │                              Port: 8080                                  ││
│  └──────────────────────────────────┬──────────────────────────────────────┘│
│                                     │                                        │
│  ┌──────────────────────────────────▼──────────────────────────────────────┐│
│  │                          handlers.c (Dispatch)                          ││
│  └──────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┘│
│         │          │          │          │          │          │            │
│         ▼          ▼          ▼          ▼          ▼          ▼            │
│  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐  │
│  │session.c ││ lobby.c  ││ match.c  ││broadcast ││protocol.c││ rating.c │  │
│  │(In-mem)  ││(In-mem)  ││(In-mem)  ││.c        ││          ││          │  │
│  └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘  │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌──────────────────┐                               │
│                          │      db.c        │                               │
│                          │     (ODBC)       │                               │
│                          └────────┬─────────┘                               │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ TDS Protocol
                                    ▼
                          ┌──────────────────────┐
                          │     SQL Server       │
                          │     XiangqiDB        │
                          │     Port: 1433       │
                          └──────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Ngôn ngữ | Port | Trách nhiệm |
|-----------|----------|------|-------------|
| Browser Client | JavaScript | - | UI, game logic client-side, WebSocket client |
| WS Bridge | Node.js | 8081 | Chuyển đổi WebSocket ↔ TCP |
| C Server | C | 8080 | Game server, matchmaking, auth, persistence |
| SQL Server | T-SQL | 1433 | User data, match history |

### 1.3 In-Memory vs Persistent Storage

| Dữ liệu | Lưu trữ | Lý do |
|---------|---------|-------|
| Sessions | In-memory | Fast access, expire sau 24h |
| Active Matches | In-memory | Real-time updates |
| Ready Players | In-memory | Transient state |
| Challenges | In-memory | Expire sau 60s |
| Users | SQL Server | Persistent |
| Match History | SQL Server | Persistent |
| Ratings | SQL Server | Persistent |

---

## 2. LUỒNG KẾT NỐI

### 2.1 Connection Establishment

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Browser   │          │  WS Bridge  │          │  C Server   │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │ 1. WS Connect          │                        │
       │──────────────────────>│                        │
       │                        │                        │
       │ 2. WS Handshake OK     │ 3. TCP Connect         │
       │<──────────────────────│───────────────────────>│
       │                        │                        │
       │                        │ 4. Connection Ready    │
       │                        │<───────────────────────│
       │                        │                        │
       │ 5. Ready to Send       │                        │
       │<──────────────────────│                        │
       │                        │                        │
```

### 2.2 Message Flow

```
Browser                    WS Bridge                   C Server
   │                          │                           │
   │ JSON Message             │                           │
   ├─────────────────────────>│                           │
   │                          │ JSON + newline            │
   │                          ├──────────────────────────>│
   │                          │                           │
   │                          │            Process...     │
   │                          │                           │
   │                          │ Response JSON + newline   │
   │                          │<──────────────────────────┤
   │ JSON Response            │                           │
   │<─────────────────────────┤                           │
   │                          │                           │
```

### 2.3 Disconnection Handling

```
Browser                    WS Bridge                   C Server
   │                          │                           │
   │ X Connection Lost        │                           │
   │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ X│                           │
   │                          │                           │
   │                          │ Detect disconnect         │
   │                          ├──────────────────────────>│
   │                          │                           │
   │                          │ Remove from lobby         │
   │                          │ Keep match active (30min) │
   │                          │                           │
```

---

## 3. LUỒNG XÁC THỰC

### 3.1 Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REGISTRATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

Browser                    WS Bridge                   C Server          Database
   │                          │                           │                  │
   │ 1. Register Request      │                           │                  │
   │ {type:"register",        │                           │                  │
   │  payload:{               │                           │                  │
   │    username:"player1",   │                           │                  │
   │    email:"...",          │                           │                  │
   │    password:"hash..."}}  │                           │                  │
   ├─────────────────────────>│                           │                  │
   │                          │ 2. Forward                │                  │
   │                          ├──────────────────────────>│                  │
   │                          │                           │                  │
   │                          │                    3. Validate username      │
   │                          │                           │ db_check_username│
   │                          │                           ├─────────────────>│
   │                          │                           │<─────────────────┤
   │                          │                           │                  │
   │                          │                    4. If not exists:         │
   │                          │                           │ db_create_user   │
   │                          │                           ├─────────────────>│
   │                          │                           │<─────────────────┤
   │                          │                           │                  │
   │                          │ 5. Success Response       │                  │
   │                          │<──────────────────────────┤                  │
   │ 6. Registration OK       │                           │                  │
   │ {success:true,           │                           │                  │
   │  payload:{user_id:123}}  │                           │                  │
   │<─────────────────────────┤                           │                  │
   │                          │                           │                  │
```

### 3.2 Login Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 LOGIN FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Browser                    WS Bridge                   C Server          
   │                          │                           │
   │ 1. Login Request         │                           │
   │ {type:"login",           │                           │
   │  payload:{               │                           │
   │    username:"player1",   │                           │
   │    password:"hash..."}}  │                           │
   ├─────────────────────────>│                           │
   │                          │ 2. Forward                │
   │                          ├──────────────────────────>│
   │                          │                           │
   │                          │          3. Verify credentials
   │                          │             db_get_user_by_username()
   │                          │             Compare password hash
   │                          │                           │
   │                          │          4. If valid:     │
   │                          │             session_create(user_id)
   │                          │             → Generate 64-char token
   │                          │                           │
   │                          │          5. Update client state:
   │                          │             client->user_id = user_id
   │                          │             client->authenticated = true
   │                          │             client->session_token = token
   │                          │                           │
   │                          │ 6. Success Response       │
   │                          │<──────────────────────────┤
   │ 7. Login OK              │                           │
   │ {success:true,           │                           │
   │  payload:{               │                           │
   │    token:"abc123...",    │                           │
   │    user_id:123,          │                           │
   │    username:"player1",   │                           │
   │    rating:1200}}         │                           │
   │<─────────────────────────┤                           │
   │                          │                           │
   │ 8. Store token in        │                           │
   │    sessionStorage        │                           │
   │                          │                           │
```

### 3.3 Session Validation

```
Mỗi request sau login:
   │
   ├── Extract token từ request
   │
   ├── session_validate(token, &user_id)
   │   │
   │   ├── Find session in array
   │   ├── Check expiration (24h)
   │   ├── Return user_id if valid
   │   │
   │   └── Return false if invalid/expired
   │
   ├── If valid: Process request
   │
   └── If invalid: Return error "Invalid token"
```

---

## 4. LUỒNG MATCHMAKING

### 4.1 Set Ready Flow

```
Browser                    C Server                    Lobby
   │                          │                           │
   │ set_ready(ready:true)    │                           │
   ├─────────────────────────>│                           │
   │                          │ validate_token()          │
   │                          ├──────────────────────────>│
   │                          │                           │
   │                          │ lobby_set_ready(          │
   │                          │   user_id,                │
   │                          │   username,               │
   │                          │   rating,                 │
   │                          │   ready=true)             │
   │                          ├──────────────────────────>│
   │                          │                           │ Add to ready_players[]
   │                          │                           │
   │ Response: Ready status   │                           │
   │<─────────────────────────┤                           │
   │                          │                           │
```

### 4.2 Find Match Flow (No Opponent Available)

```
Browser                    C Server                    Lobby
   │                          │                           │
   │ find_match(mode:random)  │                           │
   ├─────────────────────────>│                           │
   │                          │                           │
   │                          │ lobby_find_random_match() │
   │                          ├──────────────────────────>│
   │                          │                           │ Search ready_players
   │                          │        No opponent found  │
   │                          │<──────────────────────────┤
   │                          │                           │
   │                          │ lobby_set_ready(true)     │
   │                          ├──────────────────────────>│
   │                          │                           │ Add to queue
   │                          │                           │
   │ Response: Queued         │                           │
   │ {status:"queued"}        │                           │
   │<─────────────────────────┤                           │
   │                          │                           │
   │ Display "Searching..."   │                           │
   │                          │                           │
```

### 4.3 Find Match Flow (Opponent Available)

```
Player A                   C Server                    Player B
   │                          │                           │
   │ find_match(mode:random)  │                           │
   ├─────────────────────────>│                           │
   │                          │                           │
   │                          │ lobby_find_random_match() │
   │                          │ Found: Player B           │
   │                          │                           │
   │                          │ is_user_connected(B)?     │
   │                          │ → Yes                     │
   │                          │                           │
   │                          │ match_create(A, B, ...)   │
   │                          │ → match_id: "match_1_..." │
   │                          │                           │
   │                          │ Randomly assign colors:   │
   │                          │   A = red, B = black      │
   │                          │                           │
   │                          │ lobby_remove_player(A)    │
   │                          │ lobby_remove_player(B)    │
   │                          │                           │
   │ match_found Event        │ match_found Event         │
   │ {match_id, your_color:   │ {match_id, your_color:    │
   │  "red", opponent:"B"}    │  "black", opponent:"A"}   │
   │<─────────────────────────┤─────────────────────────>│
   │                          │                           │
   │ Redirect to game.html    │     Redirect to game.html │
   │                          │                           │
```

### 4.4 Rated Match Algorithm

```python
def find_rated_match(user_id, user_rating, tolerance=200):
    best_match = None
    min_diff = infinity
    
    for player in ready_players:
        if player.user_id == user_id:
            continue
        
        rating_diff = abs(player.rating - user_rating)
        
        if rating_diff <= tolerance and rating_diff < min_diff:
            min_diff = rating_diff
            best_match = player
    
    return best_match
```

---

## 5. LUỒNG GAME

### 5.1 Game Start Flow

```
Player A (Red)             C Server                 Player B (Black)
   │                          │                           │
   │ Received match_found     │     Received match_found  │
   │                          │                           │
   │ Redirect to game.html    │     Redirect to game.html │
   │                          │                           │
   │ join_match(match_id)     │                           │
   ├─────────────────────────>│                           │
   │                          │ Validate token            │
   │                          │ Find match                │
   │                          │ Check A is player         │
   │                          │                           │
   │ Response: joined         │                           │
   │ {move_count:0,           │     join_match(match_id)  │
   │  current_turn:"red",     │<─────────────────────────┤
   │  is_my_turn:true}        │                           │
   │<─────────────────────────┤ Response: joined          │
   │                          │ {move_count:0,            │
   │ setupBoard(flipped:false)│  current_turn:"red",      │
   │                          │  is_my_turn:false}        │
   │                          ├─────────────────────────>│
   │                          │                           │
   │                          │     setupBoard(flipped:true)
   │                          │                           │
   │ [Red's turn - can move]  │  [Black's turn - waiting] │
   │                          │                           │
```

### 5.2 Move Flow

```
Player A (Red)             C Server                 Player B (Black)
   │                          │                           │
   │ Click piece at (9,0)     │                           │
   │ Piece selected           │                           │
   │                          │                           │
   │ Click destination (7,0)  │                           │
   │                          │                           │
   │ Local validation:        │                           │
   │  - validateMove()        │                           │
   │  - Board.movePiece()     │                           │
   │  - isSuisideMove()       │                           │
   │                          │                           │
   │ If valid:                │                           │
   │ move request             │                           │
   │ {match_id,               │                           │
   │  from_row:9, from_col:0, │                           │
   │  to_row:7, to_col:0}     │                           │
   ├─────────────────────────>│                           │
   │                          │                           │
   │                          │ Validate:                 │
   │                          │  - Token valid            │
   │                          │  - Match exists           │
   │                          │  - User is player         │
   │                          │  - Is user's turn         │
   │                          │  - Basic move validation  │
   │                          │                           │
   │                          │ match_add_move()          │
   │                          │  - Store move             │
   │                          │  - Increment move_count   │
   │                          │  - Switch turn            │
   │                          │                           │
   │ Response: accepted       │                           │
   │<─────────────────────────┤                           │
   │                          │ opponent_move Event       │
   │                          │ {from:{row:9,col:0},      │
   │                          │  to:{row:7,col:0}}        │
   │                          ├─────────────────────────>│
   │                          │                           │
   │                          │     handleOpponentMove()  │
   │                          │     Animate piece         │
   │                          │     Update board state    │
   │                          │     Switch turn           │
   │                          │                           │
   │ [Wait for opponent]      │  [Black's turn - can move]│
   │                          │                           │
```

### 5.3 Game End Flows

#### 5.3.1 Resign

```
Player A                   C Server                 Player B
   │                          │                           │
   │ resign(match_id)         │                           │
   ├─────────────────────────>│                           │
   │                          │                           │
   │                          │ match_end(match_id,       │
   │                          │   result="B_wins",        │
   │                          │   reason="resign")        │
   │                          │                           │
   │                          │ rating_calculate()        │
   │                          │   A loses rating          │
   │                          │   B gains rating          │
   │                          │                           │
   │                          │ db_update_user_rating()   │
   │                          │ db_update_user_stats()    │
   │                          │ db_save_match()           │
   │                          │                           │
   │ game_end Event           │ game_end Event            │
   │ {result:"loss",          │ {result:"win",            │
   │  rating_change:-15}      │  rating_change:+15}       │
   │<─────────────────────────┤─────────────────────────>│
   │                          │                           │
   │ Show result modal        │     Show result modal     │
   │                          │                           │
```

#### 5.3.2 Draw

```
Player A                   C Server                 Player B
   │                          │                           │
   │ draw_offer(match_id)     │                           │
   ├─────────────────────────>│                           │
   │                          │                           │
   │ Response: sent           │ draw_offer Event          │
   │<─────────────────────────┤─────────────────────────>│
   │                          │                           │
   │                          │     Show draw offer modal │
   │                          │     [Accept] [Decline]    │
   │                          │                           │
   │                          │     draw_response(accept) │
   │                          │<─────────────────────────┤
   │                          │                           │
   │                          │ If accepted:              │
   │                          │   match_end(draw)         │
   │                          │   rating unchanged        │
   │                          │   db_save_match()         │
   │                          │                           │
   │ game_end Event           │ game_end Event            │
   │ {result:"draw"}          │ {result:"draw"}           │
   │<─────────────────────────┤─────────────────────────>│
   │                          │                           │
```

---

## 6. THUẬT TOÁN CỜ TƯỚNG

### 6.1 Board Representation

```
     Col  0   1   2   3   4   5   6   7   8
Row 0    [Xe][Ma][Tu][Si][Tg][Si][Tu][Ma][Xe]  ← ĐEN
    1    [  ][  ][  ][  ][  ][  ][  ][  ][  ]
    2    [  ][Ph][  ][  ][  ][  ][  ][Ph][  ]
    3    [To][  ][To][  ][To][  ][To][  ][To]
    4    ════════════ SÔNG ════════════════
    5    [To][  ][To][  ][To][  ][To][  ][To]
    6    [  ][Ph][  ][  ][  ][  ][  ][Ph][  ]
    7    [  ][  ][  ][  ][  ][  ][  ][  ][  ]
    8    [  ][  ][  ][  ][  ][  ][  ][  ][  ]
    9    [Xe][Ma][Tu][Si][Tg][Si][Tu][Ma][Xe]  ← ĐỎ

Trong code: board[row][col]
- board[0][4] = Tướng Đen
- board[9][4] = Tướng Đỏ
```

### 6.2 Move Validation Algorithm

```javascript
function movePiece(piece, targetRow, targetCol) {
    // 1. Kiểm tra bounds
    if (targetRow < 0 || targetRow > 9 || targetCol < 0 || targetCol > 8) {
        return false;
    }
    
    // 2. Kiểm tra có phải quân của mình
    if (piece.color !== currentTurn) {
        return false;
    }
    
    // 3. Kiểm tra không ăn quân đồng đội
    const targetPiece = board[targetRow][targetCol];
    if (targetPiece && targetPiece.color === piece.color) {
        return false;
    }
    
    // 4. Kiểm tra luật di chuyển của từng loại quân
    if (!piece.canMove(targetRow, targetCol, board)) {
        return false;
    }
    
    // 5. Kiểm tra nước đi có tự chiếu Tướng mình
    if (isSuisideMove(piece, targetRow, targetCol, board)) {
        return false;
    }
    
    return true;
}
```

### 6.3 Check Detection Algorithm

```javascript
function isCheck(color, board) {
    // 1. Tìm Tướng đối phương
    const opponentColor = (color === 'red') ? 'black' : 'red';
    const generalPos = findGeneral(opponentColor, board);
    
    if (!generalPos) return false;
    
    // 2. Lấy tất cả quân của màu hiện tại
    const attackers = findEnemies(color, board);
    
    // 3. Kiểm tra từng quân có thể ăn Tướng không
    for (const attacker of attackers) {
        if (attacker.canMove(generalPos.row, generalPos.col, board)) {
            return true;  // Tướng bị chiếu
        }
    }
    
    return false;
}
```

### 6.4 Suicide Move Detection

```javascript
function isSuisideMove(piece, targetRow, targetCol, board) {
    // 1. Clone board để mô phỏng
    const testBoard = cloneBoard(board);
    
    // 2. Thực hiện nước đi trên bản sao
    testBoard[piece.row][piece.col] = null;
    testBoard[targetRow][targetCol] = {
        ...piece,
        row: targetRow,
        col: targetCol
    };
    
    // 3. Kiểm tra Tướng mình có bị chiếu sau nước đi
    const myColor = piece.color;
    const enemyColor = (myColor === 'red') ? 'black' : 'red';
    
    return isCheck(enemyColor, testBoard);  // Đối phương có thể chiếu Tướng mình
}
```

### 6.5 Checkmate Detection Algorithm

```javascript
function isCheckMate(color, board) {
    // color = màu bị kiểm tra checkmate (đang bị chiếu)
    
    // 1. Lấy tất cả quân của color
    const myPieces = findEnemies(color, board);
    
    // 2. Với mỗi quân, thử tất cả nước đi có thể
    for (const piece of myPieces) {
        const possibleMoves = getPossiblePositions(piece, board);
        
        for (const [targetRow, targetCol] of possibleMoves) {
            // 3. Kiểm tra nước đi có hợp lệ
            if (!piece.canMove(targetRow, targetCol, board)) {
                continue;
            }
            
            // 4. Kiểm tra nước đi có giải được chiếu
            if (!isSuisideMove(piece, targetRow, targetCol, board)) {
                return false;  // Tìm được nước đi thoát chiếu → không phải checkmate
            }
        }
    }
    
    return true;  // Không có nước đi nào thoát được → Chiếu bí!
}
```

### 6.6 Flying General Detection

```javascript
// Trong General.canMove()
function getAttackableMove(turn, board) {
    const direction = (this.color === 'red') ? -1 : 1;  // Hướng về phía đối phương
    
    let row = this.row + direction;
    
    // Quét dọc theo cột về phía đối phương
    while (row >= 0 && row <= 9) {
        const piece = board[row][this.col];
        
        if (piece) {
            // Gặp quân khác → không có phi tướng
            if (piece.type !== 'general') {
                return null;
            }
            // Gặp Tướng đối phương → có thể phi tướng
            if (piece.color !== this.color) {
                return [row - this.row, 0];  // Vector tấn công
            }
        }
        
        row += direction;
    }
    
    return null;
}
```

### 6.7 Piece Movement Rules

#### Tướng (General)
```
Directions: [[1,0], [-1,0], [0,1], [0,-1]]  // + Flying general
Constraints:
  - Cột 3-5
  - Đỏ: Hàng 7-9
  - Đen: Hàng 0-2
```

#### Sĩ (Advisor)
```
Directions: [[1,1], [1,-1], [-1,1], [-1,-1]]
Constraints:
  - Cột 3-5
  - Đỏ: Hàng 7-9
  - Đen: Hàng 0-2
```

#### Tượng (Elephant)
```
Directions: [[2,2], [2,-2], [-2,2], [-2,-2]]
Constraints:
  - Không qua sông (Đỏ: hàng 5-9, Đen: hàng 0-4)
  - Kiểm tra cản "mắt" tại (row+1, col+1)
```

#### Mã (Horse)
```
Directions: [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [-1,2], [1,-2], [-1,-2]]
Blocking check:
  - Nếu đi 2 hàng: kiểm tra (row+1, col) hoặc (row-1, col)
  - Nếu đi 2 cột: kiểm tra (row, col+1) hoặc (row, col-1)
```

#### Xe (Chariot)
```
Movement: Ngang/dọc không giới hạn
Algorithm:
  1. Xác định hướng (up/down/left/right)
  2. Đi từng ô đến khi:
     - Gặp rìa bàn → dừng
     - Gặp quân đồng đội → dừng trước đó
     - Gặp quân địch → bao gồm ô đó (ăn)
```

#### Pháo (Cannon)
```
Movement: Như Xe nhưng ăn khác
Algorithm:
  1. Đếm số quân giữa nguồn và đích
  2. Nếu đích trống: phải có 0 quân chắn
  3. Nếu đích có quân địch: phải có đúng 1 quân chắn (màn)
```

#### Tốt (Pawn)
```
Before crossing river:
  - Đỏ: Chỉ đi lên (row--)
  - Đen: Chỉ đi xuống (row++)

After crossing river:
  - Đỏ (row <= 4): Lên/trái/phải
  - Đen (row >= 5): Xuống/trái/phải

Never: Đi lùi
```

---

## 7. THUẬT TOÁN ELO RATING

### 7.1 Công Thức Elo

#### Expected Score (Xác suất thắng kỳ vọng)
$$E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}$$

Trong đó:
- $E_A$ = Xác suất kỳ vọng A thắng
- $R_A$ = Rating của A
- $R_B$ = Rating của B

#### Rating Change (Thay đổi rating)
$$\Delta R = K \times (S - E)$$

Trong đó:
- $K = 32$ (K-factor)
- $S$ = Điểm thực tế (1.0 thắng, 0.5 hòa, 0.0 thua)
- $E$ = Điểm kỳ vọng

### 7.2 Implementation

```c
double expected_score(int rating_a, int rating_b) {
    return 1.0 / (1.0 + pow(10.0, (rating_b - rating_a) / 400.0));
}

rating_change_t rating_calculate(int red_rating, int black_rating, 
                                  const char* result, int k_factor) {
    // Tính xác suất kỳ vọng
    double red_expected = expected_score(red_rating, black_rating);
    double black_expected = 1.0 - red_expected;
    
    // Điểm thực tế
    double red_actual, black_actual;
    if (strcmp(result, "red_wins") == 0) {
        red_actual = 1.0;
        black_actual = 0.0;
    } else if (strcmp(result, "black_wins") == 0) {
        red_actual = 0.0;
        black_actual = 1.0;
    } else {  // draw
        red_actual = 0.5;
        black_actual = 0.5;
    }
    
    // Tính thay đổi rating
    rating_change_t change;
    change.red_change = (int)round(k_factor * (red_actual - red_expected));
    change.black_change = (int)round(k_factor * (black_actual - black_expected));
    
    return change;
}
```

### 7.3 Ví Dụ

```
Player A: 1200 rating (Đỏ)
Player B: 1400 rating (Đen)

E_A = 1 / (1 + 10^((1400-1200)/400))
E_A = 1 / (1 + 10^0.5)
E_A = 1 / (1 + 3.16)
E_A ≈ 0.24 (24% xác suất thắng)

Nếu A thắng (upset):
  ΔR_A = 32 × (1.0 - 0.24) = +24
  ΔR_B = 32 × (0.0 - 0.76) = -24

Nếu B thắng (expected):
  ΔR_A = 32 × (0.0 - 0.24) = -8
  ΔR_B = 32 × (1.0 - 0.76) = +8

Nếu hòa:
  ΔR_A = 32 × (0.5 - 0.24) = +8
  ΔR_B = 32 × (0.5 - 0.76) = -8
```

---

## 8. XỬ LÝ LỖI VÀ RECOVERY

### 8.1 Connection Error Handling

```javascript
// Client-side
websocketBridge.on('error', (error) => {
    if (error.type === 'connection') {
        showReconnectDialog();
        attemptReconnect(maxRetries: 3);
    }
});

async function attemptReconnect(retries) {
    for (let i = 0; i < retries; i++) {
        await sleep(1000 * (i + 1));  // Exponential backoff
        try {
            await connect(serverUrl);
            // Re-authenticate
            await login(savedCredentials);
            // Rejoin match if any
            if (currentMatchId) {
                await joinMatch(currentMatchId);
            }
            return true;
        } catch (e) {
            continue;
        }
    }
    showConnectionFailedError();
    return false;
}
```

### 8.2 Session Expiration

```
Server-side (mỗi 60 giây):
   │
   ├── session_cleanup_expired()
   │   │
   │   └── For each session:
   │       if (now - last_activity > SESSION_TIMEOUT):
   │           session_destroy(token)
   │
   └── lobby_cleanup_expired_challenges()
       │
       └── For each challenge:
           if (now > expires_at):
               Remove challenge
```

### 8.3 Match Recovery

```
Khi client reconnect giữa trận:
   │
   ├── Client gọi joinMatch(matchId)
   │
   ├── Server kiểm tra:
   │   ├── Match còn active?
   │   ├── User là player trong match?
   │   └── Token hợp lệ?
   │
   ├── Nếu valid:
   │   ├── Return current game state
   │   │   - move_count
   │   │   - current_turn
   │   │   - is_my_turn
   │   └── Client restore state và tiếp tục
   │
   └── Nếu invalid:
       └── Return error, redirect to lobby
```

### 8.4 Database Error Handling

```c
// db.c
bool db_create_user(...) {
    // ...
    SQLRETURN ret = SQLExecute(stmt);
    
    if (!SQL_SUCCEEDED(ret)) {
        db_print_error(stmt, SQL_HANDLE_STMT, "Failed to create user");
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;  // Caller handles error
    }
    
    // ...
}

// handlers.c
void handle_register(...) {
    // ...
    int user_id;
    if (!db_create_user(username, email, password, &user_id)) {
        send_response(server, client, seq, false, 
                      "Registration failed. Please try again.", NULL);
        return;
    }
    // ...
}
```

---

## 📊 TỔNG KẾT

| Luồng | Số bước | Thời gian ước tính |
|-------|---------|-------------------|
| Kết nối | 5 | < 100ms |
| Đăng ký | 6 | < 500ms |
| Đăng nhập | 8 | < 300ms |
| Tìm trận (có đối thủ) | 5 | < 100ms |
| Thực hiện nước đi | 6 | < 50ms |
| Kết thúc game | 5 | < 500ms |

---

**Kết thúc tài liệu System Flow**
