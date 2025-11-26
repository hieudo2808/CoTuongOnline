/*
 * broadcast.c - Broadcast messages to multiple clients
 */

#include "broadcast.h"

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>

#include "lobby.h"
#include "match.h"
#include "server.h"

// Send message to specific client by fd
bool send_to_client(server_t* server, int client_fd, const char* message) {
    if (!server || !message || client_fd < 0) {
        return false;
    }

    // Find client
    client_t* client = NULL;
    for (int i = 0; i < server->client_count; i++) {
        if (server->clients[i]->fd == client_fd) {
            client = server->clients[i];
            break;
        }
    }

    if (!client) {
        fprintf(stderr, "[Broadcast] Client fd %d not found\n", client_fd);
        return false;
    }

    // Add newline if not present
    char buffer[MAX_MESSAGE_SIZE];
    snprintf(buffer, sizeof(buffer), "%s%s", message,
             (message[strlen(message) - 1] == '\n') ? "" : "\n");

    ssize_t sent = send(client_fd, buffer, strlen(buffer), MSG_NOSIGNAL);
    if (sent < 0) {
        perror("[Broadcast] send() failed");
        return false;
    }

    printf("[Broadcast] Sent to fd %d: %.*s\n", client_fd,
           (int)(strlen(buffer) - 1), buffer);
    return true;
}

// Send to specific user by user_id
bool send_to_user(server_t* server, int user_id, const char* message) {
    if (!server || !message || user_id <= 0) {
        return false;
    }

    // Find client with this user_id
    for (int i = 0; i < server->client_count; i++) {
        if (server->clients[i]->user_id == user_id) {
            return send_to_client(server, server->clients[i]->fd, message);
        }
    }

    fprintf(stderr, "[Broadcast] User %d not connected\n", user_id);
    return false;
}

// Broadcast to all clients in a match
void broadcast_to_match(server_t* server, const char* match_id,
                        const char* message) {
    if (!server || !match_id || !message) {
        return;
    }

    // Get match
    match_t* match = match_find_by_id(match_id);
    if (!match) {
        fprintf(stderr, "[Broadcast] Match %s not found\n", match_id);
        return;
    }

    // Send to both players
    send_to_user(server, match->red_user_id, message);
    send_to_user(server, match->black_user_id, message);

    printf("[Broadcast] Sent to match %s (users %d, %d)\n", match_id,
           match->red_user_id, match->black_user_id);
}

// Broadcast to all ready players in lobby
void broadcast_to_lobby(server_t* server, const char* message) {
    if (!server || !message) {
        return;
    }

    // Get all ready users
    int ready_users[MAX_CLIENTS];
    int count = lobby_get_ready_users(ready_users, MAX_CLIENTS);

    // Send to each ready user
    for (int i = 0; i < count; i++) {
        send_to_user(server, ready_users[i], message);
    }

    printf("[Broadcast] Sent to %d ready users in lobby\n", count);
}

// Broadcast to all connected clients
void broadcast_to_all(server_t* server, const char* message) {
    if (!server || !message) {
        return;
    }

    int sent_count = 0;
    for (int i = 0; i < server->client_count; i++) {
        if (send_to_client(server, server->clients[i]->fd, message)) {
            sent_count++;
        }
    }

    printf("[Broadcast] Sent to %d/%d clients\n", sent_count,
           server->client_count);
}
