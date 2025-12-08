# 📘 TÀI LIỆU FRONTEND - CỜ TƯỚNG ONLINE

**Phiên bản:** 1.0  
**Ngày cập nhật:** 8/12/2025

---

## 📑 MỤC LỤC

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Các File Core](#2-các-file-core)
3. [Các Quân Cờ (Pieces)](#3-các-quân-cờ-pieces)
4. [Giao Diện UI](#4-giao-diện-ui)
5. [Network Layer](#5-network-layer)
6. [Utilities](#6-utilities)
7. [Luồng Dữ Liệu](#7-luồng-dữ-liệu)

---

## 1. TỔNG QUAN KIẾN TRÚC

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                      │
│  ┌─────────────────┐                                                       │
│  │  renderer.js    │ ◄────── Render bàn cờ, quân cờ, trạng thái lượt      │
│  │  (UI class)     │         Tạo/cập nhật DOM elements                     │
│  └────────┬────────┘                                                       │
└───────────┼────────────────────────────────────────────────────────────────┘
            │ renderBoard(), updateTurn(), flipBoard()
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           CONTROLLER LAYER                                 │
│  ┌─────────────────────┐     extends     ┌─────────────────────────┐      │
│  │ gameController.js   │ ◄──────────────│ networkGameController.js │      │
│  │                     │                 │                         │      │
│  │ - handleBoardClick  │                 │ - connectToServer       │      │
│  │ - executeMove       │                 │ - handleOpponentMove    │      │
│  │ - switchTurn        │                 │ - login/register        │      │
│  │ - checkGameStatus   │                 │ - findMatch             │      │
│  └──────────┬──────────┘                 └───────────┬─────────────┘      │
└─────────────┼────────────────────────────────────────┼────────────────────┘
              │ movePiece(), isCheck(), isCheckMate()  │ sendMove(), events
              ▼                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            CORE LAYER                                      │
│  ┌─────────────────┐                     ┌──────────────────────────┐     │
│  │   board.js      │                     │  websocketBridge.js      │     │
│  │   (Board)       │                     │  (NetworkBridge)         │     │
│  │                 │                     │                          │     │
│  │ - board[10][9]  │                     │ - WebSocket connection   │     │
│  │ - placePiece    │                     │ - send/sendAndWait       │     │
│  │ - movePiece     │                     │ - event listeners        │     │
│  │ - isCheck       │                     │ - hashPassword           │     │
│  │ - isCheckMate   │                     └──────────────────────────┘     │
│  └────────┬────────┘                                                       │
└───────────┼────────────────────────────────────────────────────────────────┘
            │ validateMove()
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           MODEL LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                        pieces/*.js                                 │    │
│  │  ┌───────────┐                                                     │    │
│  │  │ChessPiece │ ◄── Base class                                      │    │
│  │  └─────┬─────┘                                                     │    │
│  │        │ extends                                                   │    │
│  │  ┌─────┴─────┬─────────┬─────────┬─────────┬────────┬────────┐    │    │
│  │  ▼           ▼         ▼         ▼         ▼        ▼        ▼    │    │
│  │ General   Chariot    Horse   Elephant  Advisor  Cannon   Pawn     │    │
│  │  (将)      (車)       (馬)      (象)      (士)     (砲)    (兵)    │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CÁC FILE CORE

### 2.1 `src/core/board.js` - Logic Bàn Cờ

**Mục đích:** Quản lý trạng thái bàn cờ, vị trí quân, kiểm tra nước đi, phát hiện chiếu/chiếu bí.

**Dòng code:** 1-227

#### Cấu Trúc Dữ Liệu

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `board` | `Array[10][9]` | Mảng 2D đại diện bàn cờ Tướng (10 hàng × 9 cột) |
| `turn` | `string` | Lượt hiện tại: `"red"` hoặc `"black"` |
| `status` | `boolean` | Trạng thái game: `true` = đang chơi, `false` = kết thúc |
| `curPiece` | `ChessPiece\|null` | Quân cờ đang được chọn |
| `turnCnt` | `number` | Đếm số lượt đã đi |

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 11-17 | - | - | Khởi tạo trạng thái bàn cờ |
| `placePiece()` | 19-52 | `type, color, row, col` | `void` | Tạo và đặt quân cờ lên bàn theo loại |
| `initBoard()` | 54-68 | `initialPosition` | `void` | Khởi tạo bàn cờ 10×9 rỗng và đặt các quân |
| `movePiece()` | 70-90 | `piece, x, y` | `boolean` | Kiểm tra nước đi hợp lệ (bounds, tự sát, sở hữu, luật quân) |
| `findEnemies()` | 92-106 | `color, board` | `ChessPiece[]` | Trả về tất cả quân của màu chỉ định |
| `findGeneral()` | 108-123 | `color, board` | `{row, col}` | Tìm vị trí Tướng đối phương |
| `isCheck()` | 125-140 | `turn, board` | `boolean` | Kiểm tra Tướng đối phương có bị chiếu không |
| `isSuisideMove()` | 142-154 | `piece, x, y, board` | `boolean` | Kiểm tra nước đi có tự chiếu Tướng mình không |
| `cloneBoard()` | 156-172 | `board` | `Array[10][9]` | Tạo bản sao nông của bàn cờ để mô phỏng |
| `getPossiblePos()` | 174-199 | `piece, dir, board` | `Array<[row,col]>` | Lấy tất cả vị trí có thể đi theo hướng |
| `isCheckMate()` | 201-225 | `turn, board` | `boolean` | Kiểm tra đối phương có bị chiếu bí không |

#### Thuật Toán Chính

**Phát Hiện Chiếu (Dòng 125-140):**
```
1. Tìm vị trí Tướng đối phương
2. Lấy tất cả quân của màu hiện tại (kẻ địch của Tướng)
3. Với mỗi quân địch, kiểm tra nó có thể đi hợp lệ đến vị trí Tướng không
4. Nếu có bất kỳ quân nào đi được → Tướng bị chiếu
```

**Phát Hiện Chiếu Bí (Dòng 201-225):**
```
1. Lấy tất cả quân của đối phương
2. Với mỗi quân, lấy tất cả ô đích có thể
3. Với mỗi ô đích, kiểm tra nước đi hợp lệ VÀ không tự chiếu Tướng mình
4. Nếu CÓ BẤT KỲ nước đi hợp lệ nào → KHÔNG chiếu bí
5. Nếu KHÔNG có nước đi hợp lệ → CHIẾU BÍ
```

**Phát Hiện Nước Đi Tự Sát (Dòng 142-154):**
```
1. Tạo bản sao của bàn cờ
2. Mô phỏng nước đi trên bản sao
3. Kiểm tra Tướng mình có bị chiếu sau nước đi không
4. Trả về true nếu bị chiếu (nước đi tự sát)
```

---

### 2.2 `src/core/gameController.js` - Controller Chính

**Mục đích:** Điều khiển game chính - xử lý logic game, sự kiện UI, thực hiện nước đi, quản lý trạng thái.

**Dòng code:** 1-489

#### Cấu Trúc Dữ Liệu

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `chessboard` | `Board` | Instance của Board class |
| `eventListeners` | `Map` | Hệ thống event emitter |
| `stack` | `Record[]` | Lịch sử nước đi |
| `ui` | `UI` | Instance của UI renderer |
| `initialPosition` | `Array` | Vị trí khởi đầu các quân |
| `boardContainerId` | `string` | ID của DOM container |
| `boundChoosePiece` | `Function` | Handler đã bind context |
| `boundCancelPiece` | `Function` | Handler đã bind context |
| `isFlipped` | `boolean` | Trạng thái lật bàn cờ |

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 8-55 | Linh hoạt: container ID hoặc mảng vị trí | - | Khởi tạo controller với signature linh hoạt |
| `initUI()` | 60-82 | `boardContainerId` | `boolean` | Khởi tạo UI muộn |
| `reset()` | 87-112 | - | `void` | Reset game về trạng thái ban đầu |
| `bindEvents()` | 114-152 | - | `void` | Gán sự kiện click sử dụng event delegation |
| `handleNewGame()` | 154-156 | - | `void` | Reload trang |
| `handleResign()` | 158-160 | - | `void` | Đặt status = false |
| `handleBoardClick()` | 162-211 | `event` | `void` | Xử lý click bàn cờ - chọn quân/thực hiện nước đi |
| `executeMove()` | 213-260 | `newRow, newCol` | `boolean` | Thực hiện nước đi đã validate, cập nhật DOM và state |
| `switchTurn()` | 262-268 | - | `void` | Chuyển lượt giữa đỏ/đen |
| `checkGameStatus()` | 270-300 | - | `void` | Kiểm tra chiếu/chiếu bí sau mỗi nước đi |
| `recordMove()` | 302-339 | `curRow, curCol, newRow, newCol, clickedPiece, targetPiece` | `void` | Ghi lại nước đi |
| `choosePiece()` | 341-361 | `event` | `void` | Xử lý chọn quân (legacy) |
| `cancelPiece()` | 363-381 | `event` | `void` | Xử lý bỏ chọn quân (legacy) |
| `initListeners()` | 383-401 | - | `void` | Cập nhật listeners dựa trên game state |
| `on()` | 408-413 | `event, callback` | `void` | Đăng ký event listener |
| `off()` | 418-424 | `event, callback` | `void` | Xóa event listener |
| `emit()` | 429-440 | `event, ...args` | `void` | Emit event đến listeners |
| `setupBoard()` | 447-458 | `options` | `boolean` | Setup bàn cờ với tùy chọn lật |
| `flipBoard()` | 463-474 | - | `void` | Lật bàn cờ 180° (cho người chơi đen) |
| `validateMove()` | 479-500 | `from, to` | `boolean` | Validate nước đi hợp lệ |

#### Luồng Sự Kiện

```
User Click → bindEvents() → handleBoardClick()
                              ↓
                    [Chưa chọn quân?]
                      ↓ Có          ↓ Không
                  choosePiece()   [Click vào quân đang chọn?]
                                    ↓ Có          ↓ Không
                                  Bỏ chọn    movePiece() hợp lệ?
                                                 ↓ Có    ↓ Không
                                             executeMove() → Thử chọn quân khác
                                                 ↓
                                             switchTurn()
                                                 ↓
                                             checkGameStatus()
                                                 ↓
                                             emit('move-made')
```

---

### 2.3 `src/core/networkGameController.js` - Controller Mạng

**Mục đích:** Mở rộng GameController với khả năng multiplayer qua mạng.

**Dòng code:** 1-463

#### Cấu Trúc Dữ Liệu Bổ Sung

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `network` | `NetworkBridge` | Instance WebSocket bridge |
| `token` | `string\|null` | Token xác thực session |
| `userId` | `string\|null` | ID người dùng hiện tại |
| `matchId` | `string\|null` | ID trận đấu hiện tại |
| `myColor` | `"red"\|"black"\|null` | Màu được gán cho người chơi |
| `isOnlineMatch` | `boolean` | Có đang trong trận online không |
| `isMyTurn` | `boolean` | Có phải lượt của mình không |
| `onMatchFound` | `Function\|null` | Callback khi tìm thấy trận |
| `onOpponentMove` | `Function\|null` | Callback khi đối thủ đi |
| `onGameEnd` | `Function\|null` | Callback khi game kết thúc |
| `onError` | `Function\|null` | Callback khi có lỗi kết nối |
| `onChatMessage` | `Function\|null` | Callback khi nhận chat |
| `onDrawOffer` | `Function\|null` | Callback khi nhận đề nghị hòa |
| `onChallengeReceived` | `Function\|null` | Callback khi nhận thách đấu |

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 10-52 | `string\|object` | - | Constructor linh hoạt cho container ID hoặc config |
| `initUI()` | 57-64 | `boardContainerId` | `void` | Khởi tạo UI muộn |
| `connectToServer()` | 67-80 | `url` | `Promise<boolean>` | Kết nối đến WebSocket server |
| `setupNetworkListeners()` | 83-99 | - | `void` | Setup các event handlers cho network |
| `register()` | 102-115 | credentials | `Promise<object>` | Đăng ký tài khoản mới |
| `login()` | 118-142 | credentials | `Promise<object>` | Đăng nhập và lấy token |
| `setReady()` | 145 | `ready` | `Promise` | Set trạng thái sẵn sàng matchmaking |
| `joinMatch()` | 149-163 | `matchId` | `Promise<object>` | Tham gia lại trận đang có |
| `findMatch()` | 166-175 | `mode` ("rated") | `Promise<object>` | Bắt đầu matchmaking |
| `handleMatchFound()` | 177-202 | `matchData` | `void` | Xử lý event tìm thấy trận, setup bàn cờ |
| `executeMove()` | 206-259 | Overloaded: (row, col) hoặc (from, to) | `boolean` | Thực hiện nước đi với đồng bộ server |
| `handleOpponentMove()` | 261-300 | `moveData` | `void` | Xử lý nước đi của đối thủ từ server |
| `resign()` | 326-339 | - | `Promise` | Đầu hàng |
| `offerDraw()` | 342-355 | - | `Promise` | Đề nghị hòa |
| `sendChatMessage()` | 358-373 | `message` | `Promise` | Gửi chat |
| `handleDrawOffer()` | 376-383 | `data` | `void` | Xử lý đề nghị hòa đến |
| `handleGameEnd()` | 386-393 | `data` | `void` | Xử lý event game kết thúc |
| `getLeaderboard()` | 396-404 | `limit, offset` | `Promise<array>` | Lấy bảng xếp hạng |
| `getMatchDetails()` | 407-415 | `matchId` | `Promise<object>` | Lấy chi tiết trận |
| `handleReadyPlayersUpdate()` | 418-421 | `data` | `void` | Xử lý cập nhật danh sách sẵn sàng |
| `challengePlayer()` | 424-433 | `opponentId, rated` | `Promise` | Gửi thách đấu |
| `handleChallengeReceived()` | 436-442 | `data` | `void` | Xử lý thách đấu đến |
| `handleChatMessage()` | 445-453 | `data` | `void` | Xử lý chat đến |
| `disconnect()` | 456-463 | - | `void` | Ngắt kết nối và cleanup |

#### Luồng Mạng

```
connectToServer() → setupNetworkListeners()
                          ↓
                    login()/register()
                          ↓
                    setReady() / findMatch()
                          ↓
              [Server gửi match_found]
                          ↓
                    handleMatchFound()
                          ↓
                    setupBoard({flipped})
                          ↓
            [Vòng lặp Game: Lượt người chơi]
                          ↓
          executeMove() → network.sendMove()
                          ↓
              [Server validate & broadcast]
                          ↓
           handleOpponentMove() ← event opponent_move
```

---

### 2.4 `src/core/config.js` - Cấu Hình Game

**Mục đích:** Hằng số game và cấu hình vị trí khởi đầu.

**Dòng code:** 1-20

#### Hằng Số

| Hằng số | Dòng | Giá trị | Mô tả |
|---------|------|---------|-------|
| `OPENING_POSITION` | 4-5 | String | Định nghĩa quân cờ phân cách bởi `;` |
| `BOARD_HEIGHT` | 8 | `10` | Chiều cao bàn cờ |
| `BOARD_WIDTH` | 9 | `9` | Chiều rộng bàn cờ |

#### Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `parsePosition()` | 12-15 | `positionString` | `string[][]` | Parse chuỗi vị trí thành mảng 2D |

**Format vị trí:** `loại,màu,hàng,cột` mỗi quân phân cách bởi `;`

---

## 3. CÁC QUÂN CỜ (PIECES)

### 3.1 `ChessPiece.js` - Base Class

**Dòng code:** 1-36

**Mục đích:** Lớp trừu tượng cơ sở cho tất cả quân cờ.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `color` | `string` | `"red"` hoặc `"black"` |
| `icon` | `string` | Ký tự Hán hiển thị |
| `type` | `string` | Loại quân (identifier) |
| `col` | `number` | Vị trí cột (0-8) |
| `row` | `number` | Vị trí hàng (0-9) |

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 5-11 | Various | - | Khởi tạo quân |
| `isTeammate()` | 13-18 | Position, board | `boolean` | Kiểm tra ô có quân đồng đội không |
| `validateMove()` | 20-28 | Position, valid moves, board | `boolean` | Validate với mảng nước đi hợp lệ |
| `canMove()` | 31-33 | Position, board | `boolean` | Abstract - phải override |

---

### 3.2 `General.js` - Tướng (將/帥)

**Dòng code:** 1-62

**Mục đích:** Quân Tướng - giới hạn trong cung, có thể bắt Tướng đối phương qua "phi tướng".

**Mảng hướng đi:**
```javascript
dir = [[1,0], [-1,0], [0,1], [0,-1], [0,0]]  // [0,0] = tấn công phi tướng
```

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `getAttackableMove()` | 17-35 | `turn` | `[rowDelta, 0]\|null` | Tìm Tướng đối phương cùng cột |
| `canMove()` | 37-60 | Position, board | `boolean` | Validate nước đi trong cung + phi tướng |

**Thuật toán Phi Tướng:**
```
1. Nhìn dọc cột về phía đối phương
2. Nếu không có quân nào chắn và tìm thấy Tướng đối phương → nước đi tấn công hợp lệ
```

**Giới hạn Cung:**
- Cột: 3-5
- Hàng Đỏ: 7-9
- Hàng Đen: 0-2

---

### 3.3 `Chariot.js` - Xe (車/车)

**Dòng code:** 1-101

**Mục đích:** Quân Xe - đi ngang/dọc, không giới hạn số ô.

**Mảng hướng đi:** 4 hướng, mỗi hướng có 8-9 biến thể bước đi

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `getMax()` | 47-60 | `piece, direction, board` | `number` | Số bước tối đa theo hướng dọc |
| `getMaxHorizontal()` | 62-75 | `piece, direction, board` | `number` | Số bước tối đa theo hướng ngang |
| `canMove()` | 77-98 | Position, board | `boolean` | Validate di chuyển đường thẳng |

**Thuật toán:**
```
1. Với mỗi hướng (lên, xuống, trái, phải):
   a. Đếm số ô đến rìa bàn hoặc gặp quân
   b. Bao gồm ô chứa quân địch (ăn quân)
2. Xây dựng mảng nước đi hợp lệ
3. Kiểm tra đích có trong mảng không
```

---

### 3.4 `Horse.js` - Mã (馬/马)

**Dòng code:** 1-38

**Mục đích:** Quân Mã - đi hình chữ L, có thể bị cản.

**Mảng hướng đi:**
```javascript
dir = [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [-1,2], [1,-2], [-1,-2]]
```

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `canMove()` | 18-36 | Position, board | `boolean` | Validate nước đi chữ L với kiểm tra cản |

**Thuật toán Cản Mã (Dòng 28-33):**
```
1. Tính thay đổi hàng/cột
2. Tìm vị trí "chân" (ô mã phải đi qua):
   - Nếu |thay đổi hàng| = 2: chân_hàng = hàng + thay đổi/2, chân_cột = cột
   - Nếu |thay đổi cột| = 2: chân_cột = cột + thay đổi/2, chân_hàng = hàng
3. Nếu ô chân có quân → bị cản, nước đi không hợp lệ
```

---

### 3.5 `Elephant.js` - Tượng/Voi (象/相)

**Dòng code:** 1-42

**Mục đích:** Quân Tượng - đi chéo 2 ô, không qua sông.

**Mảng hướng đi:**
```javascript
dir = [[2,2], [2,-2], [-2,2], [-2,-2]]
```

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `canMove()` | 16-40 | Position, board | `boolean` | Validate nước đi chéo với giới hạn sông + cản |

**Validation:**
```
1. Kiểm tra giới hạn sông:
   - Đỏ: hàng mới phải 5-9
   - Đen: hàng mới phải 0-4
2. Kiểm tra cản "mắt" (ô giữa đường chéo)
3. Validate với mảng hướng đi
```

---

### 3.6 `Advisor.js` - Sĩ (士/仕)

**Dòng code:** 1-30

**Mục đích:** Quân Sĩ - đi chéo 1 ô, giới hạn trong cung.

**Mảng hướng đi:**
```javascript
dir = [[1,1], [1,-1], [-1,1], [-1,-1]]
```

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `canMove()` | 16-28 | Position, board | `boolean` | Validate nước đi chéo trong cung |

**Giới hạn Cung:**
- Cột: 3-5
- Hàng Đỏ: 7-9
- Hàng Đen: 0-2

---

### 3.7 `Cannon.js` - Pháo (砲/炮)

**Dòng code:** 1-48

**Mục đích:** Quân Pháo - đi như Xe nhưng ăn quân phải nhảy qua đúng 1 quân.

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `canMove()` | 8-47 | Position, board | `boolean` | Validate di chuyển/ăn quân với logic nhảy |

**Thuật toán:**
```
1. Từ chối nước đi chéo (phải ngang hoặc dọc)
2. Đếm số quân chắn giữa nguồn và đích (exclusive)
3. Kiểm tra đích:
   - Ô trống: số quân chắn phải = 0 (di chuyển thường)
   - Quân địch: số quân chắn phải = 1 (ăn qua màn)
   - Quân đồng đội: không hợp lệ
```

---

### 3.8 `Pawn.js` - Tốt/Binh (兵/卒)

**Dòng code:** 1-36

**Mục đích:** Quân Tốt - chỉ tiến trước khi qua sông, tiến/trái/phải sau khi qua sông.

**Mảng hướng đi:**
```javascript
dir = [[1,0], [-1,0], [0,1], [0,-1]]  // xuống, lên, phải, trái
```

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `canMove()` | 16-34 | Position, board | `boolean` | Validate di chuyển tốt dựa trên qua sông |

**Luật Di Chuyển:**
```
Đỏ (bắt đầu hàng 6, đi về hàng 0):
  - Trước sông (hàng > 4): chỉ dir[1] (lên, -1,0)
  - Sau sông (hàng ≤ 4): dir[1], dir[2], dir[3] (lên, trái, phải)

Đen (bắt đầu hàng 3, đi về hàng 9):
  - Trước sông (hàng < 5): chỉ dir[0] (xuống, 1,0)
  - Sau sông (hàng ≥ 5): dir[0], dir[2], dir[3] (xuống, trái, phải)
```

---

## 4. GIAO DIỆN UI

### 4.1 `src/ui/renderer.js` - Render Bàn Cờ

**Mục đích:** Render UI - tạo và quản lý bàn cờ trực quan sử dụng CSS Grid.

**Dòng code:** 1-326

#### Cấu Trúc Dữ Liệu

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `containerId` | `string` | ID container element |
| `container` | `HTMLElement\|null` | DOM container element |
| `turnIndicator` | `HTMLElement\|null` | Element hiển thị lượt |
| `movesList` | `HTMLElement\|null` | Element danh sách nước đi |
| `boardGrid` | `HTMLElement\|null` | Container grid bàn cờ |
| `buttons.newGame` | `HTMLElement\|null` | Nút ván mới |
| `buttons.resign` | `HTMLElement\|null` | Nút đầu hàng |
| `buttons.draw` | `HTMLElement\|null` | Nút đề nghị hòa |
| `isInitialized` | `boolean` | Trạng thái khởi tạo |
| `isLegacyMode` | `boolean` | Flag chế độ legacy |

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 3-22 | `containerId` | - | Tạo UI instance, có thể defer |
| `initialize()` | 24-33 | `containerId` | `boolean` | Khởi tạo muộn |
| `initModern()` | 35-38 | - | `void` | Khởi tạo chế độ render hiện đại |
| `createBoardGrid()` | 40-87 | - | `void` | Tạo cấu trúc DOM bàn cờ |
| `setupLegacyMode()` | 89-95 | - | `void` | Bind đến các DOM element có sẵn |
| `injectStyles()` | 97-232 | - | `void` | Inject CSS styles động |
| `createPiece()` | 234-250 | `piece, x, y` | `HTMLElement\|null` | Tạo element quân cờ tại vị trí |
| `clearBoard()` | 252-258 | - | `void` | Xóa tất cả quân khỏi bàn cờ |
| `renderBoard()` | 260-270 | `board` | `void` | Render toàn bộ trạng thái bàn cờ |
| `updateTurn()` | 272-279 | `turn` | `void` | Cập nhật indicator lượt |
| `flipBoard()` | 281-288 | `flipped` | `void` | Lật view bàn cờ |

#### Thuật Toán Render Bàn Cờ (Dòng 40-87)

```
1. Tạo div board-wrapper (container)
2. Tạo div xiangqi-grid (layer lưới trực quan)
   - Tạo table 9x8 cho đường kẻ
   - Đánh dấu hàng 4 là ô "sông"
   - Thêm text sông "楚 河 漢 界"
3. Tạo div piece-layer (CSS Grid overlay)
   - 9 cột × 10 hàng div piece-spot
   - Mỗi spot có data-x và data-y attributes
4. Append cả hai layer vào wrapper
5. Inject CSS styles động
```

#### Layout CSS Grid

```
CELL_SIZE = 67px
PADDING = 44px
PIECE_SIZE = 59px
FONT_SIZE = 31px

Grid: 9 cột × 10 hàng
Layer positioned với offset: PADDING - (CELL_SIZE / 2)
```

---

## 5. NETWORK LAYER

### 5.1 `src/network/websocketBridge.js` - WebSocket Bridge

**Mục đích:** Layer giao tiếp WebSocket - xử lý kết nối, protocol message, authentication, và các hành động game.

**Dòng code:** 1-594

#### Cấu Trúc Dữ Liệu

| Thuộc tính | Kiểu | Mô tả |
|------------|------|-------|
| `socket` | `WebSocket` | WebSocket instance |
| `isConnected` | `boolean` | Trạng thái kết nối |
| `sequenceNumber` | `number` | Bộ đếm sequence message |
| `token` | `string\|null` | Token authentication |
| `eventListeners` | `Map` | Hệ thống event emitter |
| `pendingRequests` | `Map` | Handler request/response đang chờ |
| `isWaitingForMatch` | `boolean` | Trạng thái đang đợi matchmaking |
| `matchSearchTimeout` | `number\|null` | ID timeout matchmaking |
| `MATCH_SEARCH_TIMEOUT` | `number` | Timeout matchmaking (60s) |

#### Protocol Message

```javascript
// Format message gửi đi
{
    type: string,       // VD: "login", "move", "find_match"
    seq: number,        // Sequence number để match request/response
    payload: object,    // Data request
    token: string       // Session token (khi đã set)
}

// Format message nhận về
{
    type: string,       // VD: "response", "match_found", "opponent_move"
    seq: number,        // Match với request sequence
    payload: object,    // Response data
    message: string,    // Status message
    success: boolean    // Flag thành công
}
```

#### Các Hàm

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `constructor()` | 7-21 | - | - | Khởi tạo bridge state |
| `connect()` | 28-66 | `url` | `Promise<boolean>` | Kết nối đến WebSocket server |
| `handleMessage()` | 71-200 | `data` | `void` | Parse và route messages đến |
| `send()` | 205-227 | `type, payload, token` | `number` | Gửi message, trả về sequence number |
| `sendAndWait()` | 232-300 | Various | `Promise` | Gửi và đợi response |
| `rejectAllPending()` | 336-343 | `error` | `void` | Reject tất cả request đang chờ |
| `on()` | 348-353 | `event, callback` | `void` | Đăng ký event listener |
| `once()` | 355-360 | `event, callback` | `void` | Đăng ký listener một lần |
| `off()` | 362-369 | `event, callback` | `void` | Xóa listener |
| `emit()` | 371-382 | `event, ...args` | `void` | Emit event |
| `hashPassword()` | 387-395 | `password` | `string` | Hash DJB2 (match C server) |
| `register()` | 400-412 | credentials | `Promise` | Đăng ký tài khoản |
| `login()` | 417-428 | credentials | `Promise` | Đăng nhập |
| `logout()` | 433-435 | - | `Promise` | Đăng xuất |
| `setReady()` | 440-442 | `ready` | `Promise` | Set trạng thái ready |
| `findMatch()` | 447-474 | Various | `Promise` | Bắt đầu matchmaking |
| `sendMove()` | 479-489 | Move coordinates | `number` | Gửi nước đi đến server |
| `resign()` | 494-496 | `matchId` | `number` | Đầu hàng |
| `offerDraw()` | 501-503 | `matchId` | `number` | Đề nghị hòa |
| `respondDraw()` | 508-514 | `matchId, accept` | `number` | Phản hồi đề nghị hòa |
| `getLeaderboard()` | 519-531 | `limit, offset` | `Promise` | Lấy bảng xếp hạng |
| `getMatchInfo()` | 536-545 | `matchId` | `Promise` | Lấy thông tin trận |
| `challengePlayer()` | 550-556 | `opponentId, rated` | `number` | Gửi thách đấu |
| `respondChallenge()` | 561-567 | `challengeId, accept` | `number` | Phản hồi thách đấu |
| `heartbeat()` | 572-574 | - | `number` | Gửi heartbeat |
| `sendChatMessage()` | 579-585 | `matchId, message` | `number` | Gửi chat |
| `disconnect()` | 590-596 | - | `void` | Ngắt kết nối và cleanup |

#### Thuật Toán Hash Password (Dòng 387-395)

```javascript
// Thuật toán hash DJB2 (tương thích C server)
hash = 5381
for each character c in password:
    hash = ((hash << 5) + hash) + charCode(c)
    hash = hash & hash  // Convert to 32-bit
return (hash >>> 0).toString(16).padStart(8, '0').padEnd(64, '0')
```

---

## 6. UTILITIES

### 6.1 `src/utils/moveNotation.js` - Ký Hiệu Nước Đi

**Dòng code:** 1-82

**Mục đích:** Tạo ký hiệu đại số cho nước cờ.

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `generateRedNotation()` | 6-41 | Piece + positions | `string` | Ký hiệu nước đi Đỏ |
| `generateBlackNotation()` | 44-80 | Piece + positions | `string` | Ký hiệu nước đi Đen |

**Format Ký Hiệu:**
- Chữ cái quân: P(tốt), R(xe), C(pháo), K(tướng), N(mã), A(sĩ), B(tượng)
- Đỏ: chữ hoa, Đen: chữ thường
- Format: `P5+2` (Tốt cột 5 tiến 2) hoặc `N3+5` (Mã cột 3 đến cột 5, tiến)

---

### 6.2 `src/utils/validators.js` - Validation

**Dòng code:** 1-232

**Mục đích:** Các utility validation input.

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `validateUsername()` | 11-36 | `string` | `{valid, error}` | 3-20 ký tự, alphanumeric+underscore |
| `validateEmail()` | 41-52 | `string` | `{valid, error}` | Validate format email |
| `validatePassword()` | 57-99 | `string` | `{valid, error}` | 8-50 ký tự, mixed case + số |
| `validateServerAddress()` | 105-135 | `string` | `{valid, error}` | Validate IP hoặc domain |
| `validatePort()` | 140-152 | `string\|number` | `{valid, error}` | Port 1-65535 |
| `sanitizeHTML()` | 159-164 | `string` | `string` | Escape HTML entities |
| `sanitizeForDisplay()` | 169-175 | `string` | `string` | Escape + giữ newlines |
| `validateChatMessage()` | 180-195 | `string` | `{valid, error}` | Validate chat (max 500 ký tự) |
| `debounce()` | 200-210 | `Function, number` | `Function` | Utility debounce |
| `throttle()` | 215-225 | `Function, number` | `Function` | Utility throttle |

---

### 6.3 `src/utils/errorHandler.js` - Xử Lý Lỗi

**Dòng code:** 1-234

**Mục đích:** Xử lý lỗi toàn cục và các loại lỗi tùy chỉnh.

**Các Lớp Lỗi Tùy Chỉnh:**

| Lớp | Dòng | Properties | Mô tả |
|-----|------|------------|-------|
| `NetworkError` | 182-187 | `code` | Lỗi mạng/kết nối |
| `ValidationError` | 189-194 | `field` | Lỗi validation input |
| `AuthError` | 196-200 | - | Lỗi authentication |
| `GameError` | 202-207 | `gameState` | Lỗi logic game |
| `TimeoutError` | 209-214 | `operation` | Lỗi timeout |

**Các Hàm ErrorHandler Class:**

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `init()` | 12-24 | - | `void` | Setup window error listeners |
| `addListener()` | 29-31 | `Function` | `void` | Đăng ký error listener |
| `handle()` | 36-50 | `error` | `void` | Xử lý và hiển thị lỗi |
| `categorize()` | 55-78 | `error` | `void` | Phân loại và hiển thị lỗi |
| `showErrorModal()` | 83-117 | `string, string, object` | `void` | Hiển thị error modal |
| `logToServer()` | 122-145 | `error` | `Promise` | Log lên server (production) |
| `wrapAsync()` | 150-160 | `Function, object` | `Function` | Wrap async với error handling |
| `wrapSync()` | 165-175 | `Function, object` | `Function` | Wrap sync với error handling |

---

### 6.4 `src/utils/loadingManager.js` - Quản Lý Loading

**Dòng code:** 1-126

**Mục đích:** Quản lý trạng thái loading và UI feedback.

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `createOverlay()` | 10-22 | - | `void` | Tạo loading overlay DOM |
| `show()` | 27-34 | `string, string` | `void` | Hiện loading cho operation |
| `hide()` | 39-47 | `string` | `void` | Ẩn loading cho operation |
| `wrapAsync()` | 52-60 | `Function, string, string` | `Function` | Wrap async với loading state |
| `showSkeleton()` | 65-70 | `string` | `void` | Thêm skeleton loader class |
| `hideSkeleton()` | 75-80 | `string` | `void` | Xóa skeleton loader class |
| `showButtonSpinner()` | 85-93 | `string` | `void` | Hiện spinner trong button |
| `hideButtonSpinner()` | 98-106 | `string` | `void` | Khôi phục text button |

---

### 6.5 `src/utils/config.js` - Cấu Hình Environment

**Dòng code:** 1-200

**Mục đích:** Quản lý cấu hình dựa trên environment.

**Cấu Hình Các Environment:**

| Environment | SERVER_HOST | SERVER_PORT | WS_PROTOCOL | DEBUG |
|-------------|-------------|-------------|-------------|-------|
| development | localhost | 8081 | ws | true |
| staging | staging.yourdomain.com | 443 | wss | false |
| production | yourdomain.com | 443 | wss | false |

| Hàm | Dòng | Tham số | Trả về | Mô tả |
|-----|------|---------|--------|-------|
| `detectEnvironment()` | 43-54 | - | `string` | Detect environment từ hostname |
| `get()` | 67-69 | `string, any` | `any` | Lấy giá trị config |
| `set()` | 74-82 | `string, any` | `void` | Set config (chỉ dev) |
| `loadFromStorage()` | 87-97 | - | `void` | Load từ localStorage |
| `saveToStorage()` | 102-119 | - | `void` | Lưu vào localStorage |
| `reset()` | 124-127 | - | `void` | Reset về defaults |
| `getWebSocketUrl()` | 137-149 | - | `string` | Build WebSocket URL |
| `isDebug()` | 154-156 | - | `boolean` | Kiểm tra debug mode |
| `isLoggingEnabled()` | 161-163 | - | `boolean` | Kiểm tra logging enabled |
| `log()` | 168-172 | `...any` | `void` | Logging có điều kiện |
| `debug()` | 177-181 | `...any` | `void` | Debug logging có điều kiện |

---

## 7. LUỒNG DỮ LIỆU

### 7.1 Khởi Tạo Game

```
parsePosition(OPENING_POSITION) → Board.initBoard() → Board.placePiece() 
→ UI.renderBoard() → GameController.bindEvents()
```

### 7.2 Nước Đi Local

```
User Click → handleBoardClick() → Board.movePiece() 
→ Piece.validateMove() → Board.isSuisideMove() 
→ executeMove() → switchTurn() → checkGameStatus()
```

### 7.3 Nước Đi Online

```
executeMove() → NetworkBridge.sendMove() → Server
Server → event opponent_move → handleOpponentMove() → super.executeMove()
```

### 7.4 Kiểm Tra Chiếu/Chiếu Bí

```
checkGameStatus() → Board.isCheck() → Board.findGeneral() + Board.findEnemies()
→ Piece.validateMove() cho mỗi quân địch về phía Tướng
→ nếu chiếu: Board.isCheckMate() → getPossiblePos() + isSuisideMove() cho tất cả quân
```

---

## 📊 THỐNG KÊ

| Thể loại | Số lượng |
|----------|----------|
| Tổng file JS | ~20 |
| Tổng dòng code JS | ~3,500 |
| File Core | 4 |
| File Pieces | 8 |
| File UI | 1 |
| File Network | 1 |
| File Utilities | 5 |

---

**Kết thúc tài liệu Frontend**
