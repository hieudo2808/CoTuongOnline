/*
 * server.c - Main server with epoll multiplexing
 * Xiangqi Multiplayer Server
 */

#include "../include/server.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <unistd.h>

#include "../include/account.h"
#include "../include/broadcast.h"
#include "../include/db.h"
#include "../include/handlers.h"
#include "../include/lobby.h"
#include "../include/match.h"
#include "../include/protocol.h"
#include "../include/session.h"

static server_t g_server;

// Signal handler for graceful shutdown
static void signal_handler(int sig) {
    if (sig == SIGINT || sig == SIGTERM) {
        printf("\nReceived signal %d, shutting down...\n", sig);
        g_server.running = false;
    }
}

// Set socket to non-blocking mode
static int set_nonblocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags == -1) return -1;
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

// Initialize server
int server_init(server_t* server, int port) {
    memset(server, 0, sizeof(server_t));

    // Create listening socket
    server->listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server->listen_fd < 0) {
        perror("socket");
        return -1;
    }

    // Set SO_REUSEADDR
    int opt = 1;
    if (setsockopt(server->listen_fd, SOL_SOCKET, SO_REUSEADDR, &opt,
                   sizeof(opt)) < 0) {
        perror("setsockopt");
        close(server->listen_fd);
        return -1;
    }

    // Bind
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);

    if (bind(server->listen_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind");
        close(server->listen_fd);
        return -1;
    }

    // Listen
    if (listen(server->listen_fd, 128) < 0) {
        perror("listen");
        close(server->listen_fd);
        return -1;
    }

    // Set non-blocking
    if (set_nonblocking(server->listen_fd) < 0) {
        perror("set_nonblocking");
        close(server->listen_fd);
        return -1;
    }

    // Create epoll instance
    server->epoll_fd = epoll_create1(0);
    if (server->epoll_fd < 0) {
        perror("epoll_create1");
        close(server->listen_fd);
        return -1;
    }

    // Add listen socket to epoll
    struct epoll_event ev;
    ev.events = EPOLLIN | EPOLLET;  // Edge-triggered
    ev.data.ptr = NULL;             // NULL indicates listen socket

    if (epoll_ctl(server->epoll_fd, EPOLL_CTL_ADD, server->listen_fd, &ev) <
        0) {
        perror("epoll_ctl");
        close(server->epoll_fd);
        close(server->listen_fd);
        return -1;
    }

    server->running = true;
    printf("Server initialized on port %d\n", port);
    printf("Listening on 0.0.0.0:%d\n", port);

    return 0;
}

// Create new client
client_t* client_create(int fd) {
    client_t* client = calloc(1, sizeof(client_t));
    if (!client) return NULL;

    client->fd = fd;
    client->authenticated = false;
    client->last_heartbeat = time(NULL);

    return client;
}

// Destroy client
void client_destroy(client_t* client) {
    if (!client) return;

    if (client->session_token) {
        session_destroy(client->session_token);
        free(client->session_token);
    }

    if (client->fd >= 0) {
        close(client->fd);
    }

    free(client);
}

// Disconnect client
void client_disconnect(server_t* server, client_t* client) {
    if (!client) return;

    printf("Client disconnected (fd=%d, user_id=%d)\n", client->fd,
           client->user_id);

    // Remove from lobby if present
    if (client->authenticated) {
        lobby_remove_player(client->user_id);
    }

    // Remove from epoll
    epoll_ctl(server->epoll_fd, EPOLL_CTL_DEL, client->fd, NULL);

    // Remove from client list
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (server->clients[i] == client) {
            server->clients[i] = NULL;
            server->client_count--;
            break;
        }
    }

    client_destroy(client);
}

// Get client by user_id
client_t* server_get_client_by_user_id(server_t* server, int user_id) {
    if (!server || user_id <= 0) return NULL;

    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (server->clients[i] && server->clients[i]->user_id == user_id) {
            return server->clients[i];
        }
    }

    return NULL;
}

// Send JSON message to client
int client_send(client_t* client, const char* json) {
    if (!client || !json) return -1;

    size_t len = strlen(json);
    if (len >= MAX_MESSAGE_SIZE - client->send_len - 2) {
        fprintf(stderr, "Send buffer full for client fd=%d\n", client->fd);
        return -1;
    }

    // Append message + newline to send buffer
    memcpy(client->send_buffer + client->send_len, json, len);
    client->send_len += len;
    client->send_buffer[client->send_len++] = '\n';
    client->send_buffer[client->send_len] = '\0';

    return 0;
}

// Handle new connection
void handle_new_connection(server_t* server) {
    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);

        int client_fd = accept(server->listen_fd,
                               (struct sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // No more connections
                break;
            }
            perror("accept");
            break;
        }

        // Check client limit
        if (server->client_count >= MAX_CLIENTS) {
            printf("Max clients reached, rejecting connection\n");
            close(client_fd);
            continue;
        }

        // Set non-blocking
        if (set_nonblocking(client_fd) < 0) {
            perror("set_nonblocking client");
            close(client_fd);
            continue;
        }

        // Create client
        client_t* client = client_create(client_fd);
        if (!client) {
            close(client_fd);
            continue;
        }

        // Add to client list
        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (server->clients[i] == NULL) {
                server->clients[i] = client;
                server->client_count++;
                break;
            }
        }

        // Add to epoll
        struct epoll_event ev;
        ev.events = EPOLLIN | EPOLLET;  // Edge-triggered
        ev.data.ptr = client;

        if (epoll_ctl(server->epoll_fd, EPOLL_CTL_ADD, client_fd, &ev) < 0) {
            perror("epoll_ctl add client");
            client_disconnect(server, client);
            continue;
        }

        printf("New connection from %s:%d (fd=%d)\n",
               inet_ntoa(client_addr.sin_addr), ntohs(client_addr.sin_port),
               client_fd);
    }
}

// Handle client read
void handle_client_read(server_t* server, client_t* client) {
    while (1) {
        ssize_t n = recv(client->fd, client->recv_buffer + client->recv_len,
                         MAX_MESSAGE_SIZE - client->recv_len - 1, 0);

        if (n < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // No more data
                break;
            }
            perror("recv");
            client_disconnect(server, client);
            return;
        }

        if (n == 0) {
            // Connection closed
            client_disconnect(server, client);
            return;
        }

        client->recv_len += n;
        client->recv_buffer[client->recv_len] = '\0';

        // Process complete messages (newline-delimited)
        char* line_start = client->recv_buffer;
        char* newline;

        while ((newline = strchr(line_start, '\n')) != NULL) {
            *newline = '\0';  // Terminate message

            if (strlen(line_start) > 0) {
                process_message(server, client, line_start);
            }

            line_start = newline + 1;
        }

        // Move remaining data to front of buffer
        size_t remaining = client->recv_buffer + client->recv_len - line_start;
        if (remaining > 0) {
            memmove(client->recv_buffer, line_start, remaining);
        }
        client->recv_len = remaining;
        client->recv_buffer[client->recv_len] = '\0';

        // Check buffer overflow
        if (client->recv_len >= MAX_MESSAGE_SIZE - 1) {
            fprintf(stderr, "Client recv buffer overflow (fd=%d)\n",
                    client->fd);
            client_disconnect(server, client);
            return;
        }
    }
}

// Handle client write
void handle_client_write(server_t* server, client_t* client) {
    while (client->send_len > client->send_offset) {
        ssize_t n = send(client->fd, client->send_buffer + client->send_offset,
                         client->send_len - client->send_offset, 0);

        if (n < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // Can't send more now
                break;
            }
            perror("send");
            client_disconnect(server, client);
            return;
        }

        client->send_offset += n;
    }

    // Reset buffer if all sent
    if (client->send_offset >= client->send_len) {
        client->send_len = 0;
        client->send_offset = 0;

        // Remove EPOLLOUT if no more data to send
        struct epoll_event ev;
        ev.events = EPOLLIN | EPOLLET;
        ev.data.ptr = client;
        epoll_ctl(server->epoll_fd, EPOLL_CTL_MOD, client->fd, &ev);
    }
}

// Process received message
void process_message(server_t* server, client_t* client, const char* json) {
    message_t* msg = parse_message(json);
    if (!msg) {
        fprintf(stderr, "Failed to parse message from client fd=%d: %s\n",
                client->fd, json);
        char* err = create_error(0, "PARSE_ERROR", "Invalid JSON", false);
        client_send(client, err);
        free(err);
        return;
    }

    printf("Received message type=%s seq=%d from fd=%d\n", msg->type, msg->seq,
           client->fd);

    // Dispatch to appropriate handler
    dispatch_handler(server, client, msg);

    free_message(msg);
}

// Main server loop
void server_run(server_t* server) {
    struct epoll_event events[MAX_EVENTS];

    printf("Server running...\n");

    while (server->running) {
        int nfds = epoll_wait(server->epoll_fd, events, MAX_EVENTS,
                              1000);  // 1s timeout

        if (nfds < 0) {
            if (errno == EINTR) continue;  // Interrupted by signal
            perror("epoll_wait");
            break;
        }

        for (int i = 0; i < nfds; i++) {
            if (events[i].data.ptr == NULL) {
                // Listen socket - new connection
                handle_new_connection(server);
            } else {
                // Client socket
                client_t* client = (client_t*)events[i].data.ptr;

                if (events[i].events & EPOLLIN) {
                    handle_client_read(server, client);
                }

                if (events[i].events & EPOLLOUT) {
                    handle_client_write(server, client);
                }

                if (events[i].events & (EPOLLERR | EPOLLHUP)) {
                    client_disconnect(server, client);
                }
            }
        }

        // Periodic cleanup
        static time_t last_cleanup = 0;
        static time_t last_timeout_check = 0;
        time_t now = time(NULL);
        
        // Check timeouts every 5 seconds
        if (now - last_timeout_check >= 5) {
            match_check_all_timeouts();
            
            // Broadcast any pending timeouts
            timeout_info_t timeouts[100];
            int timeout_count = match_get_pending_timeouts(timeouts, 100);
            
            for (int i = 0; i < timeout_count; i++) {
                char payload[256];
                snprintf(payload, sizeof(payload),
                         "{\"match_id\":\"%s\",\"result\":\"%s\",\"reason\":\"timeout\"}",
                         timeouts[i].match_id, timeouts[i].result);
                char notify[512];
                snprintf(notify, sizeof(notify),
                         "{\"type\":\"game_end\",\"payload\":%s}\n", payload);
                
                // Send to both players
                send_to_user(server, timeouts[i].red_user_id, notify);
                send_to_user(server, timeouts[i].black_user_id, notify);
                
                printf("[Server] Broadcast timeout: %s -> %s\n", 
                       timeouts[i].match_id, timeouts[i].result);
            }
            
            last_timeout_check = now;
        }
        
        if (now - last_cleanup > 60) {  // Every minute
            session_cleanup_expired();
            lobby_cleanup_expired_challenges();
            last_cleanup = now;
        }
    }
}

// Shutdown server
void server_shutdown(server_t* server) {
    printf("Shutting down server...\n");

    // Disconnect all clients
    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (server->clients[i]) {
            client_disconnect(server, server->clients[i]);
        }
    }

    if (server->epoll_fd >= 0) {
        close(server->epoll_fd);
    }

    if (server->listen_fd >= 0) {
        close(server->listen_fd);
    }

    lobby_shutdown();
    match_shutdown();
    session_shutdown();
    db_shutdown();

    printf("Server shut down complete.\n");
}

// Main entry point
int main(int argc, char* argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <port>\n", argv[0]);
        return 1;
    }

    int port = atoi(argv[1]);
    if (port <= 0 || port > 65535) {
        fprintf(stderr, "Invalid port: %s\n", argv[1]);
        return 1;
    }

    // Default connection string if not provided
    const char* conn_str = "Driver={ODBC Driver 17 for SQL "
                            "Server};Server=localhost;Database=XiangqiDB;"
                            "UID=sa;PWD=Hieudo@831;";

    // Initialize subsystems
    if (!db_init(conn_str)) {
        fprintf(stderr, "Failed to initialize database\n");
        fprintf(stderr, "Connection string: %s\n", conn_str);
        return 1;
    }

    if (!session_init()) {
        fprintf(stderr, "Failed to initialize session manager\n");
        return 1;
    }

    if (!lobby_init()) {
        fprintf(stderr, "Failed to initialize lobby\n");
        return 1;
    }

    if (!match_init()) {
        fprintf(stderr, "Failed to initialize match manager\n");
        return 1;
    }

    // Setup signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGPIPE, SIG_IGN);  // Ignore SIGPIPE

    // Initialize and run server
    if (server_init(&g_server, port) < 0) {
        return 1;
    }

    server_run(&g_server);
    server_shutdown(&g_server);

    return 0;
}
