# 🚀 Deployment Guide

> **Hướng dẫn chi tiết để deploy Cờ Tướng Multiplayer lên production**

---

## 📋 Mục Lục

-   [Tổng Quan](#-tổng-quan)
-   [Development Setup](#-development-setup)
-   [Production Deployment](#-production-deployment)
-   [WebSocket Proxy Setup](#-websocket-proxy-setup)
-   [Database Setup](#-database-setup)
-   [SSL/TLS Configuration](#-ssltls-configuration)
-   [Performance Tuning](#-performance-tuning)
-   [Monitoring & Logging](#-monitoring--logging)
-   [Troubleshooting](#-troubleshooting)
-   [Maintenance](#-maintenance)

---

## 🎯 Tổng Quan

### Deployment Architecture

```
                    ┌─────────────────┐
                    │   CLOUDFLARE    │
                    │   (CDN + DDoS)  │
                    └────────┬────────┘
                             │ HTTPS/WSS
                             │
                    ┌────────▼────────┐
                    │     NGINX       │
                    │  (Reverse Proxy │
                    │   + SSL Term)   │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
       ┌────────▼────────┐       ┌───────▼───────┐
       │  Static Files   │       │  WebSocket    │
       │  (HTML/CSS/JS)  │       │  Proxy        │
       │  Port: 80/443   │       │  Port: 8080   │
       └─────────────────┘       └───────┬───────┘
                                         │ TCP
                                 ┌───────▼───────┐
                                 │  C Server     │
                                 │  Port: 9000   │
                                 └───────┬───────┘
                                         │ ODBC
                                 ┌───────▼───────┐
                                 │  SQL Server   │
                                 │  Port: 1433   │
                                 └───────────────┘
```

### System Requirements

**Server:**

-   OS: Ubuntu 20.04+ / Windows Server 2019+
-   CPU: 2+ cores
-   RAM: 4GB+ (8GB recommended)
-   Storage: 20GB+ SSD
-   Network: 100Mbps+

**Database:**

-   SQL Server 2019+ / SQL Server Express
-   10GB+ storage
-   Regular backups

---

## 💻 Development Setup

### 1. Local Development

**Clone & Install:**

```bash
git clone https://github.com/yourusername/CoTuong.git
cd CoTuong
```

**Setup Database:**

```sql
-- See database_setup.sql
sqlcmd -S localhost -i database_setup.sql
```

**Build Server:**

```bash
cd network/c_server

# Linux
make

# Windows (Visual Studio)
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

**Run Server:**

```bash
# Linux
./server

# Windows
.\Release\server.exe
```

**Serve Client:**

```bash
# Python
python -m http.server 8080

# Node.js
npx http-server -p 8080

# VS Code Live Server
# Right-click app.html → Open with Live Server
```

**Configure WebSocket:**

Browser không thể kết nối trực tiếp TCP server, cần WebSocket proxy:

**Option 1: ws-tcp-relay (Nhanh nhất)**

```bash
npm install -g websocket-tcp-relay
ws-tcp-relay --listen 8080 --connect 127.0.0.1:9000
```

**Option 2: nginx (Production-ready)**

```nginx
# /etc/nginx/sites-available/xiangqi-dev
server {
    listen 8080;

    location /ws {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Update Client Config:**

```javascript
// src/utils/config.js
export const CONFIG = {
    WS_URL: "ws://localhost:8080/ws", // Development
    // WS_URL: 'wss://yourdomain.com/ws',  // Production
};
```

**Test:**

1. Mở `http://localhost:8080/app.html`
2. Đăng ký tài khoản
3. Tìm trận (cần 2 browser/tab)
4. Chơi cờ + chat

---

## 🌐 Production Deployment

### 1. Server Preparation

**Update System:**

```bash
sudo apt update && sudo apt upgrade -y
```

**Install Dependencies:**

```bash
# Build tools
sudo apt install build-essential cmake git -y

# SQL Server ODBC driver
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list | \
    sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt update
sudo ACCEPT_EULA=Y apt install msodbcsql17 unixodbc-dev -y

# nginx
sudo apt install nginx -y

# Certbot (SSL)
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Deploy C Server

**Clone Code:**

```bash
cd /opt
sudo git clone https://github.com/yourusername/CoTuong.git
cd CoTuong/network/c_server
```

**Build:**

```bash
make clean
make CFLAGS="-O3 -march=native"
```

**Configure:**

```bash
# Edit database connection
sudo nano src/db.c

# Update:
const char* conn_str = "DRIVER={ODBC Driver 17 for SQL Server};"
                       "SERVER=your-db-server.database.windows.net,1433;"
                       "DATABASE=ChineseChess;"
                       "UID=your_admin_user;"
                       "PWD=your_secure_password;"
                       "Encrypt=yes;"
                       "TrustServerCertificate=no;";
```

**Create Systemd Service:**

```bash
sudo nano /etc/systemd/system/xiangqi-server.service
```

```ini
[Unit]
Description=Xiangqi Game Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/CoTuong/network/c_server
ExecStart=/opt/CoTuong/network/c_server/server
Restart=always
RestartSec=5

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/xiangqi

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

**Start Service:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable xiangqi-server
sudo systemctl start xiangqi-server
sudo systemctl status xiangqi-server
```

**Check Logs:**

```bash
sudo journalctl -u xiangqi-server -f
```

### 3. Deploy Client Files

**Copy Files:**

```bash
sudo mkdir -p /var/www/xiangqi
sudo cp -r /opt/CoTuong/{app.html,index.html,src,public} /var/www/xiangqi/
```

**Set Permissions:**

```bash
sudo chown -R www-data:www-data /var/www/xiangqi
sudo chmod -R 755 /var/www/xiangqi
```

**Update Config:**

```bash
sudo nano /var/www/xiangqi/src/utils/config.js
```

```javascript
export const CONFIG = {
    WS_URL: "wss://yourdomain.com/ws", // Production WSS
    API_URL: "https://yourdomain.com",
    HEARTBEAT_INTERVAL: 30000,
    RECONNECT_DELAY: 5000,
};
```

---

## 🔌 WebSocket Proxy Setup

### Nginx Configuration

**Create Config:**

```bash
sudo nano /etc/nginx/sites-available/xiangqi
```

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    return 301 https://$server_name$request_uri;
}

# HTTPS + WebSocket
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static Files
    root /var/www/xiangqi;
    index app.html;

    location / {
        try_files $uri $uri/ =404;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # WebSocket Proxy
    location /ws {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward real IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;

        # Buffering
        proxy_buffering off;
    }

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;
}
```

**Enable Site:**

```bash
sudo ln -s /etc/nginx/sites-available/xiangqi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 💾 Database Setup

### SQL Server on Azure

**1. Create Azure SQL Database:**

```bash
az sql server create \
  --name xiangqi-db-server \
  --resource-group xiangqi-rg \
  --location eastus \
  --admin-user xiangqi_admin \
  --admin-password "YourSecurePassword123!"

az sql db create \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name ChineseChess \
  --service-objective S0
```

**2. Configure Firewall:**

```bash
# Allow Azure services
az sql server firewall-rule create \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your server IP
az sql server firewall-rule create \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name AllowAppServer \
  --start-ip-address YOUR_SERVER_IP \
  --end-ip-address YOUR_SERVER_IP
```

**3. Initialize Schema:**

```bash
sqlcmd -S xiangqi-db-server.database.windows.net \
       -d ChineseChess \
       -U xiangqi_admin \
       -P "YourSecurePassword123!" \
       -i database_setup.sql
```

**4. Create Indexes:**

```sql
-- Performance indexes
CREATE INDEX idx_users_rating ON Users(rating DESC);
CREATE INDEX idx_matches_created ON Matches(created_at DESC);
CREATE INDEX idx_sessions_expires ON Sessions(expires_at);
```

### Database Backup

**Automated Backups (Azure SQL):**

```bash
# Already enabled by default
# Point-in-time restore: 7-35 days
# Long-term retention: up to 10 years
```

**Manual Backup:**

```bash
# Export to .bacpac
az sql db export \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name ChineseChess \
  --admin-user xiangqi_admin \
  --admin-password "YourSecurePassword123!" \
  --storage-key-type StorageAccessKey \
  --storage-key YOUR_STORAGE_KEY \
  --storage-uri https://yourstorage.blob.core.windows.net/backups/chess-backup.bacpac
```

---

## 🔒 SSL/TLS Configuration

### Let's Encrypt (Free SSL)

**1. Obtain Certificate:**

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**2. Auto-renewal:**

```bash
# Test renewal
sudo certbot renew --dry-run

# Cronjob (already added by certbot)
sudo crontab -l
# 0 0,12 * * * certbot renew --quiet
```

**3. Verify:**

```bash
# Test SSL configuration
curl -I https://yourdomain.com

# Check certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### SSL Best Practices

**Strong Ciphers:**

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;
```

**HSTS:**

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**OCSP Stapling:**

```nginx
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
```

---

## ⚡ Performance Tuning

### Server Optimization

**1. Kernel Parameters:**

```bash
sudo nano /etc/sysctl.conf
```

```ini
# Network tuning
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File descriptors
fs.file-max = 2097152
```

```bash
sudo sysctl -p
```

**2. Limits:**

```bash
sudo nano /etc/security/limits.conf
```

```
* soft nofile 65536
* hard nofile 65536
* soft nproc 4096
* hard nproc 4096
```

**3. Nginx Tuning:**

```nginx
worker_processes auto;
worker_rlimit_nofile 65536;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Buffers
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 65;
    send_timeout 10;

    # Connection pooling
    keepalive_requests 100;
}
```

### Database Optimization

**1. Connection Pooling:**

```c
// server.c
#define DB_POOL_SIZE 10

typedef struct {
    SQLHDBC conn;
    bool in_use;
} db_connection_t;

db_connection_t db_pool[DB_POOL_SIZE];

SQLHDBC acquire_db_connection() {
    pthread_mutex_lock(&db_pool_lock);
    for (int i = 0; i < DB_POOL_SIZE; i++) {
        if (!db_pool[i].in_use) {
            db_pool[i].in_use = true;
            pthread_mutex_unlock(&db_pool_lock);
            return db_pool[i].conn;
        }
    }
    pthread_mutex_unlock(&db_pool_lock);
    return NULL;  // Pool exhausted
}
```

**2. Query Optimization:**

```sql
-- Add covering indexes
CREATE INDEX idx_sessions_token_user
ON Sessions(token) INCLUDE (user_id, expires_at);

-- Partitioning for large tables
CREATE PARTITION FUNCTION MatchDateRange (DATETIME)
AS RANGE RIGHT FOR VALUES ('2024-01-01', '2024-02-01', '2024-03-01');

-- Update statistics
UPDATE STATISTICS Users WITH FULLSCAN;
UPDATE STATISTICS Matches WITH FULLSCAN;
```

**3. Caching:**

```c
// Simple in-memory cache for sessions
typedef struct {
    char token[65];
    int user_id;
    time_t expires_at;
    time_t cached_at;
} session_cache_entry_t;

#define CACHE_SIZE 1000
#define CACHE_TTL 300  // 5 minutes

session_cache_entry_t session_cache[CACHE_SIZE];

bool get_cached_session(const char* token, int* out_user_id) {
    uint32_t hash = hash_string(token) % CACHE_SIZE;
    session_cache_entry_t* entry = &session_cache[hash];

    if (strcmp(entry->token, token) == 0) {
        time_t now = time(NULL);
        if (now < entry->expires_at && now - entry->cached_at < CACHE_TTL) {
            *out_user_id = entry->user_id;
            return true;
        }
    }
    return false;
}
```

---

## 📊 Monitoring & Logging

### Application Logging

**1. Structured Logging:**

```c
// utils/logger.c
typedef enum {
    LOG_DEBUG,
    LOG_INFO,
    LOG_WARN,
    LOG_ERROR
} log_level_t;

void log_message(log_level_t level, const char* category, const char* format, ...) {
    time_t now = time(NULL);
    struct tm* tm_info = localtime(&now);
    char timestamp[26];
    strftime(timestamp, 26, "%Y-%m-%d %H:%M:%S", tm_info);

    const char* level_str[] = {"DEBUG", "INFO", "WARN", "ERROR"};

    fprintf(stderr, "[%s] [%s] [%s] ", timestamp, level_str[level], category);

    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);

    fprintf(stderr, "\n");
}
```

**Usage:**

```c
log_message(LOG_INFO, "Auth", "User logged in: %s (ID: %d)", username, user_id);
log_message(LOG_ERROR, "Database", "Connection failed: %s", error_msg);
log_message(LOG_WARN, "Game", "Invalid move attempt by user %d", user_id);
```

**2. Log Rotation:**

```bash
sudo nano /etc/logrotate.d/xiangqi
```

```
/var/log/xiangqi/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload xiangqi-server > /dev/null
    endscript
}
```

### System Monitoring

**1. Prometheus + Grafana:**

```bash
# Install Prometheus
sudo apt install prometheus -y

# Install Grafana
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt update && sudo apt install grafana -y

sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

**2. Custom Metrics:**

```c
// metrics.c
typedef struct {
    uint64_t total_connections;
    uint64_t active_connections;
    uint64_t total_matches;
    uint64_t active_matches;
    uint64_t messages_sent;
    uint64_t messages_received;
    double avg_response_time_ms;
} server_metrics_t;

server_metrics_t metrics;

// HTTP endpoint for Prometheus
void handle_metrics_request(int client_fd) {
    char response[4096];
    snprintf(response, sizeof(response),
             "HTTP/1.1 200 OK\r\n"
             "Content-Type: text/plain\r\n\r\n"
             "# HELP xiangqi_connections Total connections\n"
             "xiangqi_connections_total %lu\n"
             "xiangqi_connections_active %lu\n"
             "# HELP xiangqi_matches Total matches\n"
             "xiangqi_matches_total %lu\n"
             "xiangqi_matches_active %lu\n"
             "# HELP xiangqi_messages Total messages\n"
             "xiangqi_messages_sent %lu\n"
             "xiangqi_messages_received %lu\n"
             "# HELP xiangqi_response_time Average response time\n"
             "xiangqi_response_time_ms %.2f\n",
             metrics.total_connections,
             metrics.active_connections,
             metrics.total_matches,
             metrics.active_matches,
             metrics.messages_sent,
             metrics.messages_received,
             metrics.avg_response_time_ms);

    send(client_fd, response, strlen(response), 0);
}
```

**3. Alerts:**

```yaml
# /etc/prometheus/alerts.yml
groups:
    - name: xiangqi
      rules:
          - alert: HighErrorRate
            expr: rate(xiangqi_errors_total[5m]) > 10
            for: 5m
            labels:
                severity: critical
            annotations:
                summary: "High error rate detected"

          - alert: HighMemoryUsage
            expr: process_resident_memory_bytes{job="xiangqi"} > 2e9
            for: 10m
            labels:
                severity: warning
            annotations:
                summary: "Server using >2GB RAM"
```

---

## 🔧 Troubleshooting

### Common Issues

**1. WebSocket Connection Fails:**

**Symptoms:**

-   Browser console: `WebSocket connection failed`
-   No messages exchanged

**Solutions:**

```bash
# Check nginx WebSocket config
sudo nginx -t

# Check if server is running
sudo systemctl status xiangqi-server

# Check firewall
sudo ufw status
sudo ufw allow 9000/tcp

# Test TCP connection
telnet localhost 9000

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

**2. Database Connection Errors:**

**Symptoms:**

-   Server log: `[Database] Connection failed`
-   Authentication fails

**Solutions:**

```bash
# Test ODBC connection
isql -v xiangqi_dsn username password

# Check connection string
sudo nano /opt/CoTuong/network/c_server/src/db.c

# Verify firewall rules
az sql server firewall-rule list \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server

# Test direct connection
sqlcmd -S xiangqi-db-server.database.windows.net \
       -d ChineseChess \
       -U xiangqi_admin \
       -P "password"
```

**3. High CPU Usage:**

**Symptoms:**

-   Server CPU at 100%
-   Slow response times

**Solutions:**

```bash
# Check top processes
top
htop

# Profile server
perf record -g -p $(pgrep server)
perf report

# Check for infinite loops
gdb -p $(pgrep server)
(gdb) thread apply all bt

# Restart service
sudo systemctl restart xiangqi-server
```

**4. Memory Leaks:**

**Symptoms:**

-   Memory usage grows over time
-   Server OOM killed

**Solutions:**

```bash
# Monitor memory
watch -n 1 'ps aux | grep server'

# Use valgrind
valgrind --leak-check=full --show-leak-kinds=all ./server

# Check for unclosed connections
ss -tan | grep :9000 | wc -l

# Restart service
sudo systemctl restart xiangqi-server
```

### Debug Mode

**Enable Debug Logging:**

```c
// config.h
#define DEBUG_MODE 1
#define LOG_LEVEL LOG_DEBUG

#if DEBUG_MODE
    #define DEBUG_LOG(fmt, ...) \
        log_message(LOG_DEBUG, "Debug", fmt, ##__VA_ARGS__)
#else
    #define DEBUG_LOG(fmt, ...)
#endif
```

**Rebuild:**

```bash
make clean
make DEBUG=1
```

---

## 🛠️ Maintenance

### Regular Tasks

**Daily:**

```bash
# Check service status
sudo systemctl status xiangqi-server

# Check disk space
df -h

# Check logs for errors
sudo journalctl -u xiangqi-server --since today | grep ERROR
```

**Weekly:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Check database size
az sql db show --resource-group xiangqi-rg \
               --server xiangqi-db-server \
               --name ChineseChess \
               --query currentSizeBytes

# Clean old sessions
sqlcmd -S ... -Q "DELETE FROM Sessions WHERE expires_at < GETDATE()"

# Rotate logs
sudo logrotate -f /etc/logrotate.d/xiangqi
```

**Monthly:**

```bash
# Review metrics
# Check Grafana dashboards

# Update SSL certificate (auto by certbot)
sudo certbot renew

# Database maintenance
sqlcmd -S ... -Q "
    UPDATE STATISTICS Users WITH FULLSCAN;
    UPDATE STATISTICS Matches WITH FULLSCAN;
    UPDATE STATISTICS Moves WITH FULLSCAN;
    ALTER INDEX ALL ON Users REBUILD;
    ALTER INDEX ALL ON Matches REBUILD;
"

# Backup database
az sql db export ...
```

### Scaling

**Horizontal Scaling (Load Balancing):**

```nginx
# /etc/nginx/nginx.conf
upstream xiangqi_backend {
    least_conn;
    server 10.0.1.10:9000;
    server 10.0.1.11:9000;
    server 10.0.1.12:9000;
}

server {
    location /ws {
        proxy_pass http://xiangqi_backend;
        # ... WebSocket config ...
    }
}
```

**Vertical Scaling:**

```bash
# Increase server resources
# Azure VM resize
az vm resize \
  --resource-group xiangqi-rg \
  --name xiangqi-vm \
  --size Standard_D4s_v3

# Increase SQL DTUs
az sql db update \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name ChineseChess \
  --service-objective S3
```

### Disaster Recovery

**Backup Strategy:**

```bash
# Automated Azure SQL backups (Point-in-time restore)
# - Automatic backups every 5-10 minutes
# - 7-35 days retention

# Application backup
tar -czf /backup/xiangqi-$(date +%Y%m%d).tar.gz \
    /opt/CoTuong \
    /var/www/xiangqi \
    /etc/nginx/sites-available/xiangqi
```

**Restore Process:**

```bash
# Restore database
az sql db restore \
  --dest-name ChineseChess_Restored \
  --resource-group xiangqi-rg \
  --server xiangqi-db-server \
  --name ChineseChess \
  --time "2024-01-15T10:30:00Z"

# Restore application
tar -xzf /backup/xiangqi-20240115.tar.gz -C /
sudo systemctl restart xiangqi-server nginx
```

---

## 📚 Additional Resources

### Documentation

-   [Nginx WebSocket Guide](https://www.nginx.com/blog/websocket-nginx/)
-   [Let's Encrypt](https://letsencrypt.org/docs/)
-   [Azure SQL Database](https://docs.microsoft.com/en-us/azure/azure-sql/)

### Tools

-   [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
-   [Prometheus Exporters](https://prometheus.io/docs/instrumenting/exporters/)
-   [SSL Labs Test](https://www.ssllabs.com/ssltest/)

---

## 🚨 Emergency Contacts

**On-call Rotation:**

-   Primary: your.email@example.com
-   Secondary: backup.email@example.com

**Incident Response:**

1. Check service status
2. Review recent logs
3. Check metrics/alerts
4. Escalate if needed

---

<p align="center">
  <strong>End of Deployment Guide</strong>
</p>

<p align="center">
  Good luck with your deployment! 🚀
</p>
