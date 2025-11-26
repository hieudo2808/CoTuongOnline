# C Client API Reference

## Overview

The C client library provides a clean API for JavaScript integration. The client can be used in three ways:

1. **Subprocess + stdin/stdout** (Recommended for web)
2. **Native addon (N-API)** (Advanced)
3. **WebSocket bridge** (Alternative)

---

## 📦 Core API

### Connection Management

#### `int client_connect(const char *host, int port)`

Connect to game server.

**Parameters:**

-   `host`: Server hostname or IP address
-   `port`: Server port number

**Returns:**

-   `0` on success
-   `-1` on failure

**Example:**

```c
if (client_connect("127.0.0.1", 9000) == 0) {
    printf("Connected!\n");
}
```

---

#### `int client_disconnect(void)`

Disconnect from server.

**Returns:**

-   `0` on success

---

#### `bool client_is_connected(void)`

Check if currently connected.

**Returns:**

-   `true` if connected
-   `false` otherwise

---

### Message Handling

#### `int client_send_json(const char *json)`

Send JSON message to server (automatically adds newline).

**Parameters:**

-   `json`: JSON string (without trailing newline)

**Returns:**

-   `0` on success
-   `-1` on failure

**Example:**

```c
const char *login_msg = "{\"type\":\"login\",\"seq\":1,\"token\":null,"
                        "\"payload\":{\"username\":\"player1\","
                        "\"password\":\"hash123\"}}";
client_send_json(login_msg);
```

---

#### `void client_set_message_callback(message_callback_t callback)`

Set callback function for received messages.

**Parameters:**

-   `callback`: Function pointer with signature `void (*callback)(const char *json)`

**Example:**

```c
void on_message(const char *json) {
    printf("Received: %s\n", json);
    // Parse JSON and handle
}

client_set_message_callback(on_message);
```

---

#### `int client_process_messages(void)`

Process incoming messages (non-blocking).

Call this in your main loop to receive messages.

**Returns:**

-   `0` on success
-   `-1` on error (connection lost)

**Example:**

```c
while (client_is_connected()) {
    client_process_messages();
    // Handle UI events, etc.
    usleep(10000); // 10ms
}
```

---

## 🔌 JavaScript Integration

### Option 1: Subprocess + stdin/stdout (Recommended)

**Architecture:**

```
Browser JS ↔ NetworkBridge.js ↔ spawn() ↔ C Client ↔ Server
```

**JavaScript Usage:**

```javascript
import NetworkBridge from "./network/js_bridge/networkBridge.js";

const network = new NetworkBridge("../network/c_client/bin/client");

// Connect
await network.connect("127.0.0.1", 9000);

// Register
const registerResponse = await network.register(
    "player1",
    "player1@test.com",
    "mypassword"
);

// Login
const loginResponse = await network.login("player1", "mypassword");

// Listen for events
network.on("match_found", (message) => {
    console.log("Match found!", message);
    startGame(message.payload);
});

// Send move
network.sendMove("match_123", {
    move_id: 1,
    from: { row: 9, col: 4 },
    to: { row: 8, col: 4 },
    piece: "general",
    notation: "帥五進一",
});

// Disconnect
network.disconnect();
```

**Pros:**

-   Simple to implement
-   Cross-platform
-   No native compilation needed

**Cons:**

-   Subprocess overhead
-   Text-based communication

---

### Option 2: Native Addon (N-API)

For better performance, wrap C client in Node.js native addon.

**File: `network/c_client/addon.c`**

```c
#include <node_api.h>
#include "client.h"

static napi_value Connect(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    // Get host string
    size_t host_len;
    napi_get_value_string_utf8(env, args[0], NULL, 0, &host_len);
    char *host = malloc(host_len + 1);
    napi_get_value_string_utf8(env, args[0], host, host_len + 1, NULL);

    // Get port number
    int32_t port;
    napi_get_value_int32(env, args[1], &port);

    // Connect
    int result = client_connect(host, port);
    free(host);

    napi_value ret;
    napi_get_boolean(env, result == 0, &ret);
    return ret;
}

static napi_value SendJSON(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    // Get JSON string
    size_t json_len;
    napi_get_value_string_utf8(env, args[0], NULL, 0, &json_len);
    char *json = malloc(json_len + 1);
    napi_get_value_string_utf8(env, args[0], json, json_len + 1, NULL);

    // Send
    int result = client_send_json(json);
    free(json);

    napi_value ret;
    napi_get_boolean(env, result == 0, &ret);
    return ret;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value connect_fn, send_fn;

    napi_create_function(env, NULL, 0, Connect, NULL, &connect_fn);
    napi_create_function(env, NULL, 0, SendJSON, NULL, &send_fn);

    napi_set_named_property(env, exports, "connect", connect_fn);
    napi_set_named_property(env, exports, "sendJSON", send_fn);

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
```

**Build with node-gyp:**

```json
{
    "targets": [
        {
            "target_name": "xiangqi_client",
            "sources": ["addon.c", "src/client.c"],
            "include_dirs": ["include"]
        }
    ]
}
```

**JavaScript Usage:**

```javascript
const client = require("./build/Release/xiangqi_client");

client.connect("127.0.0.1", 9000);
client.sendJSON(JSON.stringify(message));
```

**Pros:**

-   Best performance
-   Seamless integration

**Cons:**

-   Requires native compilation
-   Platform-specific builds

---

### Option 3: WebSocket Bridge

Run C client as WebSocket server bridge.

**File: `network/c_client/websocket_bridge.c`**

```c
// C client connects to game server
// Also starts WebSocket server on port 8080
// Forwards messages between browser <-> game server

// Implementation uses libwebsockets or similar
```

**JavaScript Usage:**

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
};

ws.send(JSON.stringify({
    type: 'login',
    payload: {...}
}));
```

**Pros:**

-   Works in browser without Node.js
-   Real-time bidirectional

**Cons:**

-   Requires WebSocket library
-   Extra layer of complexity

---

## 📖 Usage Examples

### Example 1: Simple Login

```c
#include "client.h"
#include <stdio.h>
#include <unistd.h>

void handle_message(const char *json) {
    printf("Server: %s\n", json);
}

int main() {
    // Connect
    if (client_connect("127.0.0.1", 9000) != 0) {
        fprintf(stderr, "Connection failed\n");
        return 1;
    }

    // Set callback
    client_set_message_callback(handle_message);

    // Send login
    const char *login = "{\"type\":\"login\",\"seq\":1,\"token\":null,"
                       "\"payload\":{\"username\":\"test\",\"password\":\"hash\"}}";
    client_send_json(login);

    // Process messages for 5 seconds
    for (int i = 0; i < 500; i++) {
        client_process_messages();
        usleep(10000); // 10ms
    }

    client_disconnect();
    return 0;
}
```

---

### Example 2: Full Game Flow

```c
// See network/c_client/examples/full_game.c
// Complete example with registration, login, matchmaking, and gameplay
```

---

## 🧪 Testing

### Unit Test

```bash
cd network/c_client
make test
./bin/test_client
```

### Integration Test

```bash
# Terminal 1: Start server
cd network/c_server
./bin/server 9000

# Terminal 2: Run client
cd network/c_client
./bin/client 127.0.0.1 9000
```

---

## 🐛 Debugging

### Enable Debug Logging

```c
// Define DEBUG before including headers
#define DEBUG 1
#include "client.h"
```

### Use Valgrind

```bash
valgrind --leak-check=full ./bin/client 127.0.0.1 9000
```

---

## 📚 API Reference Summary

| Function                          | Purpose           | Returns      |
| --------------------------------- | ----------------- | ------------ |
| `client_connect(host, port)`      | Connect to server | 0 / -1       |
| `client_disconnect()`             | Disconnect        | 0            |
| `client_is_connected()`           | Check connection  | true / false |
| `client_send_json(json)`          | Send message      | 0 / -1       |
| `client_set_message_callback(cb)` | Set callback      | void         |
| `client_process_messages()`       | Receive messages  | 0 / -1       |

---

## 🔗 Related Documentation

-   [Protocol Specification](../protocol.md)
-   [Server API](server_api.md)
-   [JavaScript Bridge](../js_bridge/README.md)
-   [Deployment Guide](deployment.md)

---

## 💡 Best Practices

1. **Always check return values**
2. **Set message callback before sending messages**
3. **Call `client_process_messages()` regularly in your loop**
4. **Handle disconnection gracefully**
5. **Validate JSON before sending**
6. **Use sequence numbers to match requests/responses**

---

## 🆘 Common Issues

### Issue: "Connection refused"

**Solution:** Ensure server is running and accessible.

### Issue: "Message not received"

**Solution:** Call `client_process_messages()` regularly.

### Issue: "Buffer overflow"

**Solution:** Messages too large, increase BUFFER_SIZE.

### Issue: "Callback not called"

**Solution:** Ensure callback is set before messages arrive.

---

**Version:** 1.0  
**Last Updated:** 2025-10-27
