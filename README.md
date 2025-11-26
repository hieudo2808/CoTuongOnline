# 🎮 Cờ Tướng Multiplayer# 🎮 Cờ Tướng - Xiangqi Game# 🎮 Cờ Tướng - Xiangqi Game# 🎮 Cờ Tướng - Xiangqi Game

> **Ứng dụng Cờ Tướng (Chinese Chess / Xiangqi) đa người chơi với kiến trúc Client-Server real-time**Game Cờ Tướng 2 người chơi offline.Game Cờ Tướng 2 người chơi trên cùng 1 máy.Game Cờ Tướng 2 người chơi trên cùng 1 máy, hỗ trợ networking trong tương lai.

[![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)]()## 🚀 Chạy game:## 🚀 Cách chạy:## 🚀 Cách chạy:

[![Features](https://img.shields.io/badge/Features-20%2F20-blue)]()

[![Completion](https://img.shields.io/badge/Completion-100%25-success)]()**Mở file `index.html`** bằng trình duyệt hoặc Live Server1. **Mở file `index.html`** bằng trình duyệt### Chạy nhanh:

---## 🎮 Cách chơi:2. Hoặc dùng **Live Server** trong VS Code

## 📋 Mục Lục- Click quân cờ → Click ô đích để di chuyển3. **Mở file `index.html`** bằng trình duyệt

-   [Tổng Quan](#-tổng-quan)- **New Game**: Chơi lại

-   [Tính Năng](#-tính-năng)

-   [Công Nghệ](#-công-nghệ)- **Resign**: Đầu hàng## 🎮 Cách chơi:2. Hoặc dùng **Live Server** trong VS Code (chuột phải `index.html` → Open with Live Server)

-   [Cài Đặt Nhanh](#-cài-đặt-nhanh)

-   [Hướng Dẫn Sử Dụng](#-hướng-dẫn-sử-dụng)---- Click quân cờ để chọn### Cách chơi:

-   [Cấu Trúc Project](#-cấu-trúc-project)

-   [API Protocol](#-api-protocol)## 📁 Cấu trúc:- Click ô đích để di chuyển

-   [FAQ](#-faq)

-   [Tài Liệu Khác](#-tài-liệu-khác)`````- Nhấn **"New Game"** để chơi lại- Click quân cờ để chọn

---CoTuong/

## 🎯 Tổng Quan├── index.html ⭐ MỞ FILE NÀY- Nhấn **"Resign"** để đầu hàng- Click ô đích để di chuyển

**Cờ Tướng Multiplayer** là ứng dụng web chơi cờ trực tuyến với đầy đủ tính năng:├── main.js Entry point (10 dòng)

-   ♟️ **Cờ Tướng chuẩn** với 7 loại quân cờ và đầy đủ luật chơi

-   🌐 **Multiplayer real-time** với WebSocket│- Nhấn **"New Game"** để chơi lại

-   🏆 **Hệ thống xếp hạng Elo** tự động tính rating

-   💬 **Chat trong game** và waiting room├── src/

-   📊 **Lịch sử & replay** xem lại các trận đã chơi

-   🎨 **Giao diện đẹp** responsive trên mọi thiết bị│ ├── core/ Logic game---- Nhấn **"Resign"** để đầu hàng

### ✨ Điểm Nổi Bật│ │ ├── board.js (208 dòng)

-   ✅ **100% Complete** - 20/20 tính năng hoàn thiện│ │ ├── gameController.js (244 dòng)## 📁 Cấu trúc Project:---

-   ⚡ **High Performance** - C Server với epoll, xử lý hàng nghìn kết nối

-   🔒 **Secure** - Token authentication, input validation, XSS protection│ │ └── config.js (12 dòng)

-   🏗️ **Clean Architecture** - Tách biệt UI/Logic/Network

-   📖 **Well Documented** - Documentation đầy đủ│ │````## 📁 Cấu trúc Project:

---│ ├── models/ Data models

## 🚀 Tính Năng│ │ ├── pieces.js (355 dòng)CoTuong/

### 🎮 Game Core│ │ └── record.js (16 dòng)

-   [x] Bàn cờ 10x9 chuẩn Cờ Tướng│ │├── index.html # ⭐ MỞ FILE NÀY```

-   [x] 7 loại quân: Tướng, Sĩ, Tượng, Xe, Mã, Pháo, Tốt

-   [x] Validation đầy đủ: Di chuyển, bắt quân, chiếu/chiếu hết│ ├── ui/ Giao diện

-   [x] Flying General rule (Tướng đối mặt)

│ │ └── renderer.js (190 dòng)├── main.js # Entry pointCoTuong/

### 👥 Multiplayer

│ │

-   [x] **Real-time gameplay** qua WebSocket

-   [x] **Matchmaking**: Random, Ranked, Challenge│ └── utils/ Utilities├── README.md├── index.html # ⭐ FILE CHÍNH - MỞ FILE NÀY

-   [x] **Waiting Room** với danh sách người chơi online

-   [x] **Game synchronization** đồng bộ nước đi tức thì│ └── moveNotation.js (79 dòng)

### 🏆 Competitive││├── main.js # Entry point của game

-   [x] **Elo Rating System** (K-factor: 32)└── public/ Static files

-   [x] **Leaderboard** xếp hạng top players

-   [x] **Match History** lịch sử các trận đã chơi ├── style.css├── src/ # Source code│

-   [x] **Win/Loss/Draw Statistics**

    ├── about.html

### 💬 Social

    └── rule.html│   ├── core/               # Logic game├── src/                    # Source code chính

-   [x] **Chat trong game** với đối thủ

-   [x] **Chat trong room** với tất cả người online`````

-   [x] **Real-time broadcasting**

│ │ ├── board.js (199 dòng)│ ├── core/ # Logic game core

### 📊 Data & Analytics

**→ 1,114 dòng code, 8 modules**

-   [x] **Match replay** xem lại từng nước đi

-   [x] **Move recording** lưu tất cả nước đi│ │ ├── gameController.js (289 dòng)│ │ ├── board.js # Quản lý bàn cờ (199 dòng)

-   [x] **User profiles** thông tin người chơi

---

### 🎨 UI/UX

│ │ └── config.js (12 dòng)│ │ ├── gameController.js # Controller chính (237 dòng)

-   [x] **8 Screens**: Auth, Lobby, Room, Game, Leaderboard, History, Replay, Settings

-   [x] **3 Modals**: Result, Draw Offer, Challenge## 🔧 Bảo trì:

-   [x] **Animations**: Smooth piece movement, highlights, effects

-   [x] **Responsive Design** hoạt động trên mobile/tablet/desktop│ ││ │ └── config.js # Cấu hình game (12 dòng)

### 🔒 Security| Muốn sửa | File |

-   [x] **Token Authentication** session-based|----------|------|│ ├── models/ # Data models│ │

-   [x] **Password Hashing** SHA-256

-   [x] **Input Validation** client + server side| Giao diện | `src/ui/renderer.js` + `public/style.css` |

-   [x] **SQL Injection Prevention**

-   [x] **XSS Protection**| Luật chơi | `src/core/board.js` + `src/models/pieces.js` |│ │ ├── pieces.js (355 dòng)│ ├── models/ # Data models

---| Ký hiệu nước đi | `src/utils/moveNotation.js` |

## 💻 Công Nghệ│ │ └── record.js (16 dòng)│ │ ├── pieces.js # Định nghĩa quân cờ (355 dòng)

### Client (Frontend)### Thêm tính năng mới:

| Technology | Purpose |- **AI**: Tạo `src/ai/aiPlayer.js`│ ││ │ └── record.js # Lưu lịch sử nước đi (16 dòng)

|-----------|---------|

| **Vanilla JavaScript** (ES6+) | Core logic & UI |- **Save/Load**: Tạo `src/utils/storage.js`

| **HTML5 Canvas** | Game board rendering |

| **CSS3** | Styling & animations |- **Online**: Tạo `src/network/`│ ├── ui/ # Giao diện│ │

| **WebSocket API** | Real-time communication |

---│ │ └── renderer.js (190 dòng)│ ├── ui/ # Giao diện

### Server (Backend)

## 📊 Kiến trúc (MVC):│ ││ │ └── renderer.js # Render UI (190 dòng)

| Technology | Purpose |

|-----------|---------|```│ └── utils/ # Utilities│ │

| **C** (C11) | High-performance server |

| **epoll** | Event-driven I/O |main.js → GameController ┬→ Board → Pieces

| **pthreads** | Multi-threading |

| **ODBC** | Database connectivity | └→ Renderer (UI)│ └── moveNotation.js (79 dòng)│ └── utils/ # Utilities

| **SQL Server** | Data persistence |

```

### Protocol

││ ├── moveNotation.js # Ký hiệu nước đi (79 dòng)

- **Transport**: TCP sockets

- **Format**: JSON messages---

- **Pattern**: Request-Response + Broadcasting

- **Types**: 15 message types└── public/ # Static files│ ├── constants.js # Hằng số



---**Chúc vui vẻ! 🎉**



## ⚡ Cài Đặt Nhanh    ├── style.css│       ├── helpers.js      # Hàm tiện ích



### Prerequisites    ├── about.html│       └── eventManager.js # Quản lý events



**Windows:**    └── rule.html│

```

-   Visual Studio 2019+ hoặc MinGW-w64```├── public/ # Static files

-   SQL Server 2019+

-   Python 3.x (để serve client)│ ├── style.css # Giao diện

````

**Tổng: 1,140 dòng code, chia thành 8 modules rõ ràng**│   ├── about.html          # Giới thiệu

**Linux:**

```bash│   └── rule.html           # Luật chơi

sudo apt install build-essential unixodbc-dev mssql-tools

```---│



### 1. Clone Repository├── network/                # 🌐 Networking (Future)



```bash## 🎯 Tính năng:│   ├── cpp/                # C++ Server/Client

git clone https://github.com/yourusername/CoTuong.git

cd CoTuong│   │   ├── server.cpp      # Game server

````

✅ Chơi 2 người offline │ │ └── client.cpp # Game client

### 2. Setup Database

✅ Đầy đủ luật Cờ Tướng │ │

````sql

-- Tạo database và tables✅ Phát hiện chiếu/chiếu hết  │   └── js/                 # JavaScript networking

CREATE DATABASE ChineseChess;

GO✅ Ghi lại nước đi  │       └── networkClient.js # WebSocket client



USE ChineseChess;✅ Code sạch, dễ bảo trì  │

GO

└── docs/                   # Documentation

-- Users table

CREATE TABLE Users (---    └── README.md           # Chi tiết kỹ thuật

    id INT PRIMARY KEY IDENTITY(1,1),

    username NVARCHAR(50) UNIQUE NOT NULL,```

    password_hash NVARCHAR(64) NOT NULL,

    email NVARCHAR(100) UNIQUE,## 🔧 Bảo trì:

    rating INT DEFAULT 1200,

    wins INT DEFAULT 0,---

    losses INT DEFAULT 0,

    draws INT DEFAULT 0,### Sửa giao diện:

    created_at DATETIME DEFAULT GETDATE()

);-   `src/ui/renderer.js` - Rendering UI## 🎯 Tính năng hiện tại:



-- Matches table-   `public/style.css` - CSS

CREATE TABLE Matches (

    id INT PRIMARY KEY IDENTITY(1,1),✅ Chơi 2 người offline

    red_user_id INT FOREIGN KEY REFERENCES Users(id),

    black_user_id INT FOREIGN KEY REFERENCES Users(id),### Sửa luật chơi:✅ Đầy đủ luật Cờ Tướng

    winner NVARCHAR(10),

    result_reason NVARCHAR(50),-   `src/core/board.js` - Logic bàn cờ✅ Phát hiện chiếu/chiếu hết

    is_ranked BIT DEFAULT 0,

    created_at DATETIME DEFAULT GETDATE(),-   `src/models/pieces.js` - Logic quân cờ✅ Ghi lại nước đi

    ended_at DATETIME

);✅ UI thân thiện



-- Moves table### Thêm tính năng:

CREATE TABLE Moves (

    id INT PRIMARY KEY IDENTITY(1,1),-   **AI:** Tạo `src/ai/aiPlayer.js`## 🚧 Tính năng tương lai:

    match_id INT FOREIGN KEY REFERENCES Matches(id),

    move_number INT,-   **Save/Load:** Tạo `src/utils/storage.js`

    player NVARCHAR(10),

    from_row INT,-   **Timer:** Tạo `src/utils/timer.js`🔜 Chơi online (C++ Server + WebSocket)

    from_col INT,

    to_row INT,-   **Online:** Tạo `src/network/`🔜 AI đối thủ

    to_col INT,

    piece_type NVARCHAR(20),🔜 Lưu/Load ván cờ

    captured_piece NVARCHAR(20),

    timestamp DATETIME DEFAULT GETDATE()---🔜 Phân tích nước đi

);

🔜 Timer cho mỗi người chơi

-- Sessions table

CREATE TABLE Sessions (## 📊 Kiến trúc:

    token NVARCHAR(64) PRIMARY KEY,

    user_id INT FOREIGN KEY REFERENCES Users(id),---

    created_at DATETIME DEFAULT GETDATE(),

    expires_at DATETIME```

);

```main.js## 🔧 Phát triển:



### 3. Configure Database Connection   │



Sửa file `network/c_server/src/db.c` (dòng ~30):   ▼### Sửa giao diện:



```cGameController ──┬──> Board ──> Pieces

const char* conn_str = "DRIVER={ODBC Driver 17 for SQL Server};"

                       "SERVER=localhost\\SQLEXPRESS;"                 │-   Chỉnh sửa `src/ui/renderer.js`

                       "DATABASE=ChineseChess;"

                       "UID=your_username;"                 └──> UI (Renderer)-   CSS trong `public/style.css`

                       "PWD=your_password;";

````

### 4. Build Server### Sửa luật chơi:

**Windows (Visual Studio):\*\***MVC Pattern\*\*: Model (Board, Pieces) + View (Renderer) + Controller (GameController)

```bash

cd network/c_server-   Logic bàn cờ: `src/core/board.js`

mkdir build

cd build---- Logic quân cờ: `src/models/pieces.js`

cmake ..

cmake --build . --config Release**Chúc vui vẻ! 🎉♟️**### Thêm networking:

```

1. Implement `network/cpp/server.cpp` (C++ server)

**Linux:**2. Implement `network/js/networkClient.js` (WebSocket client)

```bash3. Tích hợp vào `src/core/gameController.js`

cd network/c_server

make### Build C++ Server (trong tương lai):

````

```bash

### 5. Run Servercd network/cpp

g++ -std=c++17 server.cpp -o server -lpthread

```bash./server 8080

cd network/c_server```

./server

---

# Output:

# [Server] Starting on port 9000...## 📊 Thống kê Code:

# [Database] Connected successfully

# [Server] Ready to accept connections| Module    | Files  | Lines      | Mô tả                 |

```| --------- | ------ | ---------- | --------------------- |

| Core      | 3      | ~448       | Logic game chính      |

### 6. Serve Client| Models    | 2      | ~371       | Data models           |

| UI        | 1      | 190        | Rendering             |

```bash| Utils     | 4      | ~150       | Utilities             |

# Terminal mới| Network   | 3      | ~200       | Networking (template) |

cd CoTuong| **Total** | **13** | **~1,359** | **Clean & Modular**   |

python -m http.server 8080

---

# Hoặc dùng Live Server trong VS Code

```## 📚 Documentation:



### 7. Open Browser-   Chi tiết kỹ thuật: `docs/README.md`

-   Luật chơi: Mở `public/rule.html`

```-   Giới thiệu: Mở `public/about.html`

http://localhost:8080/app.html

```---



**Lưu ý**: Browser cần WebSocket proxy để kết nối TCP server. Xem [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**Phát triển bởi: CoTuong Team**

**License: Open Source**

---

**Chúc vui vẻ! 🎉♟️**

## 📖 Hướng Dẫn Sử Dụng

### Đăng Ký & Đăng Nhập

1. Mở `http://localhost:8080/app.html`
2. Click **"Đăng ký"** → Nhập username, password, email
3. Sau khi đăng ký, tự động đăng nhập vào Lobby

### Chơi Ranked Match

1. Từ Lobby, click **"Tìm trận Ranked"**
2. Server tìm đối thủ cùng rating
3. Khi match found → Tự động vào game
4. Chơi cờ theo lượt (Đỏ đi trước)
5. Kết thúc → Rating tự động cập nhật

### Thách Đấu (Challenge)

1. Vào **Waiting Room**
2. Chọn người chơi online
3. Click **"Thách đấu"**
4. Đối phương Accept → Bắt đầu trận

### Chat

**Trong Waiting Room:**
- Gõ tin nhắn → Enter/Send
- Tất cả người trong room thấy

**Trong Game:**
- Chat box dưới bàn cờ
- Chỉ đối thủ thấy tin nhắn

### Replay Match

1. **Match History** → Chọn trận
2. Click **"Replay"**
3. Dùng controls: `◀` `▶` `⏸` `⏩`

---

## 📁 Cấu Trúc Project

````

CoTuong/
├── app.html # Main application
├── index.html # Landing page (offline mode)
│
├── src/ # Client source
│ ├── app/
│ │ └── app.js # Application controller
│ ├── core/
│ │ ├── game.js # Game logic
│ │ ├── board.js # Board management
│ │ ├── pieces.js # Piece rules
│ │ ├── gameController.js # Local controller
│ │ └── networkGameController.js # Online controller
│ ├── network/
│ │ └── websocketBridge.js # WebSocket layer
│ ├── ui/
│ │ ├── renderer.js # Canvas rendering
│ │ ├── screens.js # Screen management
│ │ └── animations.js # Animations
│ └── utils/
│ ├── validators.js # Validation
│ ├── errorHandler.js # Error handling
│ ├── config.js # Config
│ └── loadingManager.js # Loading states
│
├── network/c_server/ # Server code
│ ├── include/ # Headers (.h)
│ │ ├── server.h
│ │ ├── handlers.h
│ │ ├── protocol.h
│ │ ├── match.h
│ │ ├── db.h
│ │ └── utils.h
│ ├── src/ # Implementation (.c)
│ │ ├── main.c
│ │ ├── server.c
│ │ ├── handlers.c
│ │ ├── match.c
│ │ ├── db.c
│ │ ├── broadcast.c
│ │ └── utils.c
│ ├── Makefile
│ └── CMakeLists.txt
│
├── public/ # Static assets
│ ├── css/styles.css
│ ├── images/pieces/
│ └── sounds/
│
├── README.md # This file
├── TECHNICAL_DOCS.md # Technical details
└── DEPLOYMENT_GUIDE.md # Deployment guide

````

**Code Stats:**
- Server (C): ~3,000 lines
- Client (JS): ~4,000 lines
- HTML/CSS: ~2,000 lines
- **Total: ~9,000 lines**

---

## 🔌 API Protocol

### Message Types (15 types)

| Type | Direction | Purpose |
|------|-----------|---------|
| `register` | C → S | Đăng ký |
| `login` | C → S | Đăng nhập |
| `logout` | C → S | Đăng xuất |
| `find_match` | C → S | Tìm trận |
| `challenge` | C → S | Thách đấu |
| `challenge_response` | C → S | Phản hồi thách đấu |
| `set_ready` | C → S | Set ready |
| `move` | C → S | Di chuyển |
| `resign` | C → S | Đầu hàng |
| `draw_offer` | C → S | Xin hòa |
| `draw_response` | C → S | Phản hồi hòa |
| `chat_message` | C → S | Chat |
| `get_match` | C → S | Lấy match info |
| `leaderboard` | C → S | Bảng xếp hạng |
| `heartbeat` | C → S | Keep-alive |

### Message Format

**Request:**
```json
{
  "type": "move",
  "seq": 123,
  "payload": {
    "token": "abc123...",
    "match_id": 42,
    "from_row": 0,
    "from_col": 4,
    "to_row": 1,
    "to_col": 4
  }
}
````

**Response:**

```json
{
    "type": "response",
    "seq": 123,
    "success": true,
    "message": "Move successful"
}
```

**Broadcast:**

```json
{
    "type": "move",
    "payload": {
        "match_id": 42,
        "player": "red",
        "from_row": 0,
        "from_col": 4,
        "to_row": 1,
        "to_col": 4
    }
}
```

Chi tiết đầy đủ: [TECHNICAL_DOCS.md](TECHNICAL_DOCS.md)

---

## ❓ FAQ

**Q: Cần cài đặt gì?**  
A: Server cần C compiler + SQL Server. Client chỉ cần browser.

**Q: Có chơi offline được không?**  
A: Có! Mở `index.html` để chơi local (2 người cùng máy hoặc vs AI).

**Q: Rating được tính như thế nào?**  
A: Hệ thống Elo (K=32), chỉ tính trong ranked match.

**Q: Hỗ trợ bao nhiêu người chơi đồng thời?**  
A: Server C với epoll xử lý được hàng nghìn kết nối.

**Q: Làm sao deploy production?**  
A: Xem hướng dẫn chi tiết trong [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## 📚 Tài Liệu Khác

-   **[TECHNICAL_DOCS.md](TECHNICAL_DOCS.md)** - Kiến trúc, implementation, code chi tiết
-   **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Hướng dẫn deployment production

---

## 📊 Thống Kê

| Metric              | Value        |
| ------------------- | ------------ |
| **Features**        | 20/20 (100%) |
| **Lines of Code**   | ~9,000       |
| **Files**           | 44           |
| **Message Types**   | 15           |
| **Screens**         | 8 + 3 modals |
| **Database Tables** | 4            |

---

## 🙏 Credits

-   Cờ Tướng rules: [Xiangqi Wikipedia](https://en.wikipedia.org/wiki/Xiangqi)
-   Icons: [Font Awesome](https://fontawesome.com/)

---

<p align="center">
  Made with ❤️ for Cờ Tướng enthusiasts
</p>

<p align="center">
  <strong>🎮 Happy Gaming! 🎉</strong>
</p>
