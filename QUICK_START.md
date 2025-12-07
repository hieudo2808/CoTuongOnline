# Hướng Dẫn Chạy Xiangqi Game

## 1. Chạy Server (C Backend)

```bash
# Terminal 1: Chạy C Server
cd /home/memory/hieudo/Code/CoTuong/network/c_server/bin

# Với password mặc định
./server 8080

# Hoặc với password tùy chỉnh
DB_PASSWORD=YourPassword ./server 8080
```

Server sẽ hiển thị:
```
[DB] Connected to SQL Server successfully
Lobby initialized
Match manager initialized
Server initialized on port 8080
Listening on 0.0.0.0:8080
Server running...
```

## 2. Chạy HTTP Server cho Client

```bash
# Terminal 2: Chạy HTTP Server
cd /home/memory/hieudo/Code/CoTuong
./start_client.sh 3000
```

Hoặc dùng Python trực tiếp:
```bash
cd /home/memory/hieudo/Code/CoTuong
python3 -m http.server 3000
```

## 3. Mở Client trong Trình Duyệt

Mở trình duyệt và truy cập:

**Multiplayer Mode:**
```
http://localhost:3000/multiplayer.html
```

**Single Player Mode:**
```
http://localhost:3000/index.html
```

## 4. Tạo Tài Khoản Test

### Cách 1: Tạo password hash
```bash
cd /home/memory/hieudo/Code/CoTuong/network/c_server
./test_hash password123
```

### Cách 2: Insert vào database
```sql
-- Copy hash từ test_hash và chạy SQL:
INSERT INTO users (username, email, password_hash, rating) 
VALUES ('player1', 'player1@test.com', 'YOUR_HASH_HERE', 1200);

INSERT INTO users (username, email, password_hash, rating) 
VALUES ('player2', 'player2@test.com', 'YOUR_HASH_HERE', 1200);
```

## 5. Kiểm Tra Kết Nối

1. Mở Console trong trình duyệt (F12)
2. Kiểm tra logs:
   - `[WebSocket] Connected to ws://localhost:8080`
   - Nếu thấy lỗi kết nối, kiểm tra server có đang chạy không

## 6. Chơi Game

### Đăng ký tài khoản mới:
1. Click "Register" trong game
2. Nhập username, email, password
3. Client sẽ tự động hash password trước khi gửi

### Đăng nhập:
1. Nhập username và password
2. Click "Login"

### Tìm trận đấu:
1. Sau khi login, click "Find Match"
2. Server sẽ ghép đôi với người chơi khác đang chờ

## Troubleshooting

### Server không khởi động
- Kiểm tra SQL Server đang chạy
- Kiểm tra password database đúng
- Xem DATABASE_SETUP.md để cấu hình

### Client không kết nối được
- Kiểm tra server đang chạy ở port 8080
- Kiểm tra config.js có đúng port không
- Mở F12 Console xem lỗi

### Lỗi CORS
- Phải dùng HTTP server (không mở file:// trực tiếp)
- Chạy `./start_client.sh` hoặc `python3 -m http.server`

## Quick Start (Tất cả trong một)

```bash
# Terminal 1: Server
cd /home/memory/hieudo/Code/CoTuong/network/c_server/bin
./server 8080

# Terminal 2: HTTP Server
cd /home/memory/hieudo/Code/CoTuong
python3 -m http.server 3000

# Browser: 
# Open http://localhost:3000/multiplayer.html
```

## Port Summary
- **8080**: C Server (WebSocket)
- **3000**: HTTP Server (Client files)
- **1433**: SQL Server (Database)
