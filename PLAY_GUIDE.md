# 🎮 Cờ Tướng Online - Hướng Dẫn Chạy Game

## 🚀 CHẠY GAME NHANH (QUICK START)

### Bước 1: Chạy Server
```bash
cd /home/memory/hieudo/Code/CoTuongOnline/network/c_server/bin
./server 8080
```

Hoặc từ thư mục gốc:
```bash
./CoTuongOnline/network/c_server/bin/server 8080
```

**Kết quả kỳ vọng:**
```
[DB] Connected to SQL Server successfully
Lobby initialized
Match manager initialized
Server initialized on port 8080
Listening on 0.0.0.0:8080
Server running...
```

### Bước 2: Chạy HTTP Server (Terminal mới)
```bash
cd CoTuongOnline
python3 -m http.server 3000
```

**Kết quả kỳ vọng:**
```
Serving HTTP on 0.0.0.0 port 3000 (http://0.0.0.0:3000/) ...
```

### Bước 3: Mở Browser
**Mở trình duyệt và truy cập:**
```
http://localhost:3000/pages/login.html
```

---

## 🎯 HƯỚNG DẪN SỬ DỤNG

### 1. Đăng Ký Tài Khoản
1. Truy cập: `http://localhost:3000/pages/login.html`
2. Nhập thông tin server:
   - Server: `127.0.0.1`
   - Port: `8080`
3. Click **"Kết Nối"**
4. Chuyển sang tab **"Đăng Ký"**
5. Nhập thông tin:
   - Username: (3-20 ký tự)
   - Email: email@example.com
   - Password: (tối thiểu 6 ký tự)
   - Xác nhận password
6. Click **"Đăng Ký"**
7. Đợi thông báo thành công

### 2. Đăng Nhập
1. Sau khi đăng ký thành công, chuyển sang tab **"Đăng Nhập"**
2. Nhập username và password
3. Click **"Đăng Nhập"**
4. Tự động chuyển sang Lobby

### 3. Tìm Đối Thủ
1. Trong **Lobby**, click nút **"⚡ Tìm Trận"**
2. Hệ thống sẽ tìm đối thủ phù hợp
3. Khi tìm thấy, click **"🎮 Bắt Đầu"**
4. Tự động chuyển sang màn chơi game

### 4. Chơi Game
- **Di chuyển:** Click vào quân cờ của bạn, sau đó click vào ô muốn di chuyển
- **Chat:** Nhập tin nhắn ở khung chat bên phải
- **Xin hòa:** Click nút "🤝 Xin Hòa"
- **Đầu hàng:** Click nút "🏳️ Đầu Hàng"
- **Timer:** Mỗi người có 10 phút

### 5. Test Multiplayer (2 Người Chơi)
**Cách 1: Mở 2 Tab Browser**
1. Tab 1: Đăng ký/đăng nhập user1
2. Tab 2: Đăng ký/đăng nhập user2
3. Cả 2 tab click "Tìm Trận"
4. Hệ thống sẽ ghép 2 người vào 1 trận

**Cách 2: Mở 2 Browser Khác Nhau**
1. Chrome: Đăng nhập user1
2. Firefox: Đăng nhập user2
3. Cả 2 tìm trận

---

## 📁 CẤU TRÚC PAGES

### Pages mới (Đã tách riêng):
```
pages/
├── login.html    - Đăng nhập/Đăng ký + Kết nối server
├── lobby.html    - Tìm đối thủ, xem BXH, menu
└── game.html     - Màn chơi game chính
```

### Navigation Flow:
```
login.html → [Đăng nhập thành công] → lobby.html → [Match found] → game.html
                                                                        ↓
                                                    [Game over] → lobby.html
```

---

## 🔧 TROUBLESHOOTING

### ❌ Server không chạy được
**Lỗi:** `Connection failed`
**Giải pháp:**
1. Kiểm tra SQL Server đã chạy chưa
2. Kiểm tra port 8080 có bị chiếm không:
   ```bash
   sudo netstat -tulpn | grep 8080
   ```
3. Rebuild server:
   ```bash
   cd network/c_server
   make clean
   make
   ```

### ❌ Không kết nối được WebSocket
**Lỗi:** `WebSocket connection failed`
**Giải pháp:**
1. Kiểm tra server đang chạy:
   ```bash
   ps aux | grep server
   ```
2. Kiểm tra firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 8080
   ```
3. Thử kết nối bằng telnet:
   ```bash
   telnet 127.0.0.1 8080
   ```

### ❌ Đăng ký thất bại
**Lỗi:** `Username already exists`
**Giải pháp:**
- Dùng username khác
- Hoặc xóa user cũ trong database:
  ```sql
  DELETE FROM Users WHERE username = 'test123';
  ```

### ❌ Login thất bại
**Lỗi:** `Invalid username or password`
**Giải pháp:**
1. Kiểm tra username/password có đúng không
2. Kiểm tra trong database:
   ```sql
   SELECT * FROM Users WHERE username = 'youruser';
   ```
3. Reset password bằng test_hash:
   ```bash
   cd network/c_server
   ./test_hash newpassword123
   # Copy hash và update database
   ```

### ❌ Không tìm được đối thủ
**Lỗi:** Searching mãi không thấy
**Giải pháp:**
- Cần ít nhất 2 người đang tìm trận cùng lúc
- Mở 2 browser/tab và login 2 user khác nhau
- Cả 2 cùng click "Tìm Trận"

### ❌ Board không hiển thị
**Lỗi:** Trắng màn hình
**Giải pháp:**
1. Mở Developer Console (F12)
2. Kiểm tra lỗi JavaScript
3. Clear cache và reload (Ctrl+Shift+R)
4. Kiểm tra file CSS đã load:
   ```
   /public/css/board.css
   /public/css/app.css
   ```

---

## 🎨 TÍNH NĂNG ĐÃ CÓ

### ✅ Backend (C Server):
- ✅ WebSocket server với epoll
- ✅ Authentication (register/login/token)
- ✅ Matchmaking system
- ✅ Real-time game synchronization
- ✅ Elo rating system
- ✅ Chat in-game
- ✅ Leaderboard
- ✅ Database persistence (SQL Server)

### ✅ Frontend (JavaScript):
- ✅ 3 pages riêng biệt (login, lobby, game)
- ✅ WebSocket client connection
- ✅ Full Xiangqi game logic (7 pieces)
- ✅ Move validation
- ✅ Check/Checkmate detection
- ✅ Animated UI với gradient đẹp
- ✅ Responsive design
- ✅ Real-time timer
- ✅ Chat functionality
- ✅ Move history

### ⚠️ Đang phát triển:
- 🔄 Undo/Redo moves
- 🔄 Game replay system
- 🔄 Friend system
- 🔄 Tournament mode
- 🔄 AI opponent (single player)

---

## 📊 KIỂM TRA LOGS

### Server Logs:
```bash
# Terminal chạy server sẽ hiển thị:
[DB] Connected to SQL Server successfully
Lobby initialized
Match manager initialized
New client connected (fd=5)
[REGISTER] User registered: test123
[LOGIN] User logged in: test123
[FIND_MATCH] User test123 looking for match
[MATCH] Created match: match_001
```

### Browser Console (F12):
```javascript
[WebSocket] Connected to ws://127.0.0.1:8080
[NetworkGame] Login successful, user: 123
[NetworkGame] Match found: match_001
[NetworkGame] Match started: match_001, playing as red
✅ Board setup complete
```

---

## 🎮 DEMO COMMANDS

### Test nhanh 1 người:
```bash
# Terminal 1: Server
./CoTuongOnline/network/c_server/bin/server 8080

# Terminal 2: HTTP Server
cd CoTuongOnline && python3 -m http.server 3000

# Browser: http://localhost:3000/pages/login.html
```

### Test multiplayer 2 người:
```bash
# Same as above, then:
# Browser 1 (Chrome): http://localhost:3000/pages/login.html (user: player1)
# Browser 2 (Firefox): http://localhost:3000/pages/login.html (user: player2)
# Both: Click "Tìm Trận"
```

---

## 🌐 URLs

| Page | URL | Mô tả |
|------|-----|-------|
| Login | `http://localhost:3000/pages/login.html` | Đăng nhập/Đăng ký |
| Lobby | `http://localhost:3000/pages/lobby.html` | Tìm trận, BXH |
| Game | `http://localhost:3000/pages/game.html` | Chơi game |
| Practice | `http://localhost:3000/app.html` | Luyện tập offline |
| Rules | `http://localhost:3000/public/rule.html` | Luật chơi |

---

## 🔐 Test Users (Có sẵn)

| Username | Password | Rating |
|----------|----------|--------|
| test123 | test123 | 1500 |
| hieudo | hieudo123 | 1500 |

**Tạo user mới:**
```bash
# Đăng ký qua UI
# Hoặc dùng test_hash để tạo password hash và INSERT vào DB
cd network/c_server
./test_hash mypassword
# Copy INSERT statement và chạy trong SQL Server
```

---

## 📝 NOTES

### Database Connection:
- Server: `localhost`
- Database: `XiangqiDB`
- User: `sa`
- Password: `Hieudo@831`
- Driver: `ODBC Driver 17 for SQL Server`

### Ports:
- **8080**: WebSocket Server (C)
- **3000**: HTTP Server (Python)
- **1433**: SQL Server

### Cache Busting:
- JavaScript files use `?v=5` to force reload
- If changes not working, increment version: `?v=6`

---

## 🎯 CHECKLIST CHƠI GAME

- [ ] Server C đang chạy (port 8080)
- [ ] HTTP server đang chạy (port 3000)
- [ ] SQL Server đang chạy
- [ ] Browser mở: `http://localhost:3000/pages/login.html`
- [ ] Kết nối server thành công
- [ ] Đăng ký user mới (hoặc dùng user có sẵn)
- [ ] Đăng nhập thành công
- [ ] Chuyển sang lobby
- [ ] Click "Tìm Trận"
- [ ] Đợi đối thủ (mở tab/browser khác nếu test 1 mình)
- [ ] Bắt đầu chơi!

---

## 🏆 KẾT QUẢ HOÀN THÀNH

✅ **HOÀN THÀNH 100%!**

- ✅ Tách UI thành 3 pages riêng biệt
- ✅ CSS đẹp, không bị đè chồng
- ✅ Server C chạy ổn định
- ✅ Client kết nối được WebSocket
- ✅ Đăng ký/Đăng nhập hoạt động
- ✅ Matchmaking system
- ✅ Real-time gameplay
- ✅ Chat, timer, move history

**🎮 SẴN SÀNG CHƠI ONLINE!**

---

*Last updated: Nov 30, 2025*
*Version: 1.0.0*
