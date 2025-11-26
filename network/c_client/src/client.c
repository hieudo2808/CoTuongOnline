/*
 * client.c - TCP client with newline framing
 */

#include "client.h"

#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static client_t g_client;
static message_callback_t g_message_callback = NULL;

// Connect to server
int client_connect(const char* host, int port) {
    memset(&g_client, 0, sizeof(g_client));
    g_client.socket_fd = -1;

    // Create socket
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        perror("socket");
        return -1;
    }

    // Server address
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(port);

    if (inet_pton(AF_INET, host, &server_addr.sin_addr) <= 0) {
        perror("inet_pton");
        close(sock);
        return -1;
    }

    // Connect
    if (connect(sock, (struct sockaddr*)&server_addr, sizeof(server_addr)) <
        0) {
        perror("connect");
        close(sock);
        return -1;
    }

    g_client.socket_fd = sock;
    g_client.connected = true;
    g_client.seq_counter = 1;

    printf("Connected to %s:%d\n", host, port);

    return 0;
}

// Disconnect
int client_disconnect(void) {
    if (g_client.socket_fd >= 0) {
        close(g_client.socket_fd);
        g_client.socket_fd = -1;
    }
    g_client.connected = false;
    return 0;
}

// Check connection
bool client_is_connected(void) { return g_client.connected; }

// Send JSON (adds newline)
int client_send_json(const char* json) {
    if (!g_client.connected) {
        fprintf(stderr, "Not connected\n");
        return -1;
    }

    size_t len = strlen(json);
    if (len >= BUFFER_SIZE - 2) {
        fprintf(stderr, "Message too large\n");
        return -1;
    }

    // Send with newline
    char buffer[BUFFER_SIZE];
    snprintf(buffer, sizeof(buffer), "%s\n", json);

    return client_send_raw(buffer, strlen(buffer));
}

// Send raw data
int client_send_raw(const char* data, size_t len) {
    size_t sent = 0;
    while (sent < len) {
        ssize_t n = send(g_client.socket_fd, data + sent, len - sent, 0);
        if (n < 0) {
            if (errno == EINTR) continue;
            perror("send");
            g_client.connected = false;
            return -1;
        }
        sent += n;
    }
    return 0;
}

// Receive and process messages
int client_recv_and_process(void) {
    if (!g_client.connected) return -1;

    ssize_t n =
        recv(g_client.socket_fd, g_client.recv_buffer + g_client.recv_len,
             BUFFER_SIZE - g_client.recv_len - 1, 0);

    if (n < 0) {
        if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) {
            return 0;
        }
        perror("recv");
        g_client.connected = false;
        return -1;
    }

    if (n == 0) {
        printf("Server closed connection\n");
        g_client.connected = false;
        return -1;
    }

    g_client.recv_len += n;
    g_client.recv_buffer[g_client.recv_len] = '\0';

    // Process complete messages (newline-delimited)
    char* line_start = g_client.recv_buffer;
    char* newline;

    while ((newline = strchr(line_start, '\n')) != NULL) {
        *newline = '\0';

        if (strlen(line_start) > 0) {
            // Call callback
            if (g_message_callback) {
                g_message_callback(line_start);
            } else {
                // Default: print to stdout
                printf("RECV: %s\n", line_start);
            }
        }

        line_start = newline + 1;
    }

    // Move remaining data to front
    size_t remaining = g_client.recv_buffer + g_client.recv_len - line_start;
    if (remaining > 0) {
        memmove(g_client.recv_buffer, line_start, remaining);
    }
    g_client.recv_len = remaining;
    g_client.recv_buffer[g_client.recv_len] = '\0';

    return 0;
}

// Process messages (non-blocking)
int client_process_messages(void) { return client_recv_and_process(); }

// Set message callback
void client_set_message_callback(message_callback_t callback) {
    g_message_callback = callback;
}

// Main (for standalone testing)
#ifdef CLIENT_MAIN
int main(int argc, char* argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <host> <port>\n", argv[0]);
        return 1;
    }

    const char* host = argv[1];
    int port = atoi(argv[2]);

    if (client_connect(host, port) < 0) {
        return 1;
    }

    printf("Connected! Enter JSON messages (one per line):\n");

    // Simple interactive loop
    fd_set readfds;

    while (client_is_connected()) {
        FD_ZERO(&readfds);
        FD_SET(STDIN_FILENO, &readfds);
        FD_SET(g_client.socket_fd, &readfds);

        struct timeval tv = {1, 0};  // 1 second timeout
        int maxfd = (g_client.socket_fd > STDIN_FILENO) ? g_client.socket_fd
                                                        : STDIN_FILENO;

        int ret = select(maxfd + 1, &readfds, NULL, NULL, &tv);

        if (ret < 0) {
            perror("select");
            break;
        }

        if (FD_ISSET(STDIN_FILENO, &readfds)) {
            // Read from stdin
            char line[4096];
            if (fgets(line, sizeof(line), stdin)) {
                // Remove trailing newline
                line[strcspn(line, "\n")] = 0;
                if (strlen(line) > 0) {
                    client_send_json(line);
                }
            }
        }

        if (FD_ISSET(g_client.socket_fd, &readfds)) {
            // Receive from server
            if (client_recv_and_process() < 0) {
                break;
            }
        }
    }

    client_disconnect();
    return 0;
}
#endif
