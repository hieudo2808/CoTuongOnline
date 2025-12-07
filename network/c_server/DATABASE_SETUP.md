# Database Setup Guide for Xiangqi Server

## SQL Server Configuration

### 1. Install SQL Server
Make sure SQL Server is installed and running on your system.

### 2. Enable SQL Server Authentication
SQL Server must allow SQL authentication (not just Windows authentication).

### 3. Set SA Password
The server connects using the `sa` (System Administrator) account.

**Default password in code**: `Hieudo@831`

### 4. Create Database
Run the SQL script to create the database:

```bash
cd /home/memory/hieudo/Code/CoTuong/network/sql
# Use the schema.sql file to create tables
```

Or use SQL Server Management Studio to execute:
- `sqlserver_schema.sql` for SQL Server

### 5. Run Server with Custom Password

**Option 1: Set environment variable**
```bash
export DB_PASSWORD=YourActualPassword
cd /home/memory/hieudo/Code/CoTuong/network/c_server
./run_server.sh 8080
```

**Option 2: Edit server.c**
Change the default password in `src/server.c` line ~471:
```c
if (!db_password) {
    db_password = "YourActualPassword";  // Change this
}
```

Then recompile:
```bash
make clean && make
```

### 6. Troubleshooting

**Error: "Login failed for user 'sa'"**
- Check SA password is correct
- Verify SQL Server allows SQL authentication:
  - SQL Server Configuration Manager > SQL Server Network Configuration
  - Enable TCP/IP protocol
  - Restart SQL Server service

**Error: "Cannot open database 'XiangqiDB'"**
- Database doesn't exist - run the schema.sql script first

**Error: "ODBC Driver 17 not found"**
- Install Microsoft ODBC Driver 17 for SQL Server
- Ubuntu: `sudo apt-get install msodbcsql17`

### 7. Test Connection

```bash
# Test with default password
cd bin
./server 8080

# Test with custom password
DB_PASSWORD=MyPassword ./server 8080
```

### 8. Create Test User

Use the `test_hash` utility to generate password hashes:

```bash
cd /home/memory/hieudo/Code/CoTuong/network/c_server
./test_hash admin123
```

Then insert into database:
```sql
INSERT INTO users (username, email, password_hash, rating) 
VALUES ('admin', 'admin@test.com', 'generated_hash_here', 1200);
```
