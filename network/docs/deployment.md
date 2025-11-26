# Deployment Guide - Xiangqi Multiplayer

## 🌍 Deployment Options

### 1. Local Network (LAN)

Easiest option for testing with friends on same network.

### 2. Public Internet

Requires port forwarding and public IP.

### 3. Cloud Server (Recommended for production)

Use AWS, DigitalOcean, Linode, etc.

---

## 🏠 Local Network Deployment

### Step 1: Build Server

```bash
cd network/c_server
make
```

### Step 2: Find Your Local IP

```bash
# Linux/Mac
ip addr show | grep inet

# Or
ifconfig | grep inet

# Windows (PowerShell)
ipconfig
```

Look for your local IP (usually `192.168.x.x` or `10.0.x.x`)

### Step 3: Run Server

```bash
./bin/server 9000
```

### Step 4: Test Connection

From another computer on same network:

```bash
telnet YOUR_LOCAL_IP 9000
```

### Step 5: Connect Clients

```bash
./bin/client YOUR_LOCAL_IP 9000
```

---

## 🌐 Public Internet Deployment

### Prerequisites

-   A public IP address (check at https://whatismyipaddress.com)
-   Access to your router's admin panel
-   A computer that can stay online

### Step 1: Configure Router (Port Forwarding)

1. **Find your router's IP** (usually `192.168.1.1` or `192.168.0.1`)

    ```bash
    # Linux/Mac
    ip route | grep default

    # Windows
    ipconfig | findstr "Default Gateway"
    ```

2. **Access router admin panel**

    - Open browser: `http://192.168.1.1`
    - Login (usually admin/admin or check router manual)

3. **Setup Port Forwarding**
    - Navigate to "Port Forwarding" or "NAT" settings
    - Add new rule:
        ```
        Service Name: Xiangqi Server
        External Port: 9000
        Internal Port: 9000
        Internal IP: YOUR_LOCAL_IP (e.g., 192.168.1.100)
        Protocol: TCP
        ```
    - Save and apply

### Step 2: Configure Firewall

#### Linux (UFW)

```bash
sudo ufw allow 9000/tcp
sudo ufw reload
```

#### Linux (iptables)

```bash
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

#### Windows Firewall

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Xiangqi Server" -Direction Inbound -Protocol TCP -LocalPort 9000 -Action Allow
```

### Step 3: Run Server

```bash
cd network/c_server
./bin/server 9000
```

### Step 4: Test External Access

From a different network (e.g., mobile phone on 4G):

```bash
telnet YOUR_PUBLIC_IP 9000
```

### Step 5: Share Connection Info

Give friends:

-   Your public IP
-   Port number (9000)

They can connect:

```bash
./bin/client YOUR_PUBLIC_IP 9000
```

---

## ☁️ Cloud Server Deployment (Recommended)

### Option 1: DigitalOcean Droplet

1. **Create Droplet**

    - Choose Ubuntu 22.04 LTS
    - Select $6/month plan (1GB RAM)
    - Choose datacenter near you

2. **Connect via SSH**

    ```bash
    ssh root@YOUR_DROPLET_IP
    ```

3. **Install Dependencies**

    ```bash
    apt update
    apt install -y build-essential libsqlite3-dev git
    ```

4. **Clone & Build**

    ```bash
    git clone YOUR_REPO_URL
    cd YOUR_REPO/network
    ./scripts/build.sh
    ```

5. **Run Server**

    ```bash
    cd c_server
    ./bin/server 9000
    ```

6. **Setup Firewall**

    ```bash
    ufw allow 22/tcp   # SSH
    ufw allow 9000/tcp # Game server
    ufw enable
    ```

7. **Run as Service** (Optional)
   Create `/etc/systemd/system/xiangqi.service`:

    ```ini
    [Unit]
    Description=Xiangqi Multiplayer Server
    After=network.target

    [Service]
    Type=simple
    User=root
    WorkingDirectory=/root/YOUR_REPO/network/c_server
    ExecStart=/root/YOUR_REPO/network/c_server/bin/server 9000
    Restart=on-failure

    [Install]
    WantedBy=multi-user.target
    ```

    Enable service:

    ```bash
    systemctl daemon-reload
    systemctl enable xiangqi
    systemctl start xiangqi
    systemctl status xiangqi
    ```

### Option 2: AWS EC2

Similar to DigitalOcean, but:

-   Choose t2.micro (free tier eligible)
-   Configure Security Group to allow port 9000

### Option 3: Linode, Vultr, etc.

Same process as DigitalOcean.

---

## 🔒 Security Considerations

### ⚠️ Risks of Home Hosting

1. **DDoS Attacks**: Your home IP is exposed
2. **Port Scanning**: Attackers can scan your network
3. **Data Privacy**: Traffic not encrypted (use TLS for production)
4. **Dynamic IP**: Home IP may change (use DDNS service)

### 🛡️ Mitigations

1. **Use Strong Passwords** for all accounts
2. **Close Port When Done**: Disable port forwarding after use
3. **Monitor Logs**: Check server logs regularly
4. **Rate Limiting**: Implement in server code (already basic protection)
5. **Consider VPN**: Use Hamachi, ZeroTier for private network

### 🔐 Production Security Checklist

-   [ ] Use HTTPS/TLS for web interface
-   [ ] Implement proper password hashing (Argon2/bcrypt)
-   [ ] Add input validation and sanitization
-   [ ] Enable SQL injection protection (parameterized queries ✓)
-   [ ] Add rate limiting per IP
-   [ ] Setup fail2ban for brute force protection
-   [ ] Use reverse proxy (nginx) with DDoS protection
-   [ ] Enable server logs and monitoring
-   [ ] Regular security updates
-   [ ] Backup database regularly

---

## 📊 Monitoring & Maintenance

### Check Server Status

```bash
# Check if server is running
ps aux | grep server

# Check port is listening
netstat -tuln | grep 9000
# Or
ss -tuln | grep 9000
```

### View Logs

```bash
# If using systemd service
journalctl -u xiangqi -f

# Or redirect to file
./bin/server 9000 > server.log 2>&1 &
tail -f server.log
```

### Database Backup

```bash
# Backup SQLite database
cp c_server/xiangqi.db xiangqi_backup_$(date +%Y%m%d).db

# Or use SQLite backup command
sqlite3 c_server/xiangqi.db ".backup xiangqi_backup.db"
```

---

## 🌍 Using DDNS (Dynamic DNS)

If your home IP changes frequently:

1. **Sign up for free DDNS service**

    - No-IP (https://www.noip.com)
    - DuckDNS (https://www.duckdns.org)
    - Dynu (https://www.dynu.com)

2. **Setup DDNS client** on your server machine

3. **Use hostname instead of IP**
    ```bash
    ./bin/client yourhostname.ddns.net 9000
    ```

---

## 🚀 Performance Tuning

### For 100+ Concurrent Users

1. **Increase system limits**

    ```bash
    # Edit /etc/security/limits.conf
    * soft nofile 65536
    * hard nofile 65536
    ```

2. **Optimize epoll**

    - Already using edge-triggered mode ✓
    - Consider thread pool for CPU-intensive operations

3. **Database optimization**
    - Add more indexes
    - Use connection pooling
    - Consider PostgreSQL for high load

---

## 📱 Mobile Access

-   Deploy on cloud server
-   Create web-based client (HTML5)
-   Or use port forwarding as described

---

## 🆘 Troubleshooting

### Server won't start

```bash
# Check if port is already in use
lsof -i :9000

# Kill existing process
kill $(lsof -t -i:9000)
```

### Can't connect from outside

1. Check port forwarding is correct
2. Check firewall allows port
3. Verify public IP hasn't changed
4. Test with telnet: `telnet PUBLIC_IP 9000`

### Connection drops frequently

1. Check ISP doesn't block ports
2. Ensure server machine doesn't sleep
3. Check for network instability
4. Implement reconnection in client

---

## 📚 Additional Resources

-   Router port forwarding guides: https://portforward.com
-   Security best practices: OWASP Top 10
-   Systemd service tutorial: DigitalOcean tutorials

---

**Remember**: For production deployment, always use a cloud server with proper security measures!
