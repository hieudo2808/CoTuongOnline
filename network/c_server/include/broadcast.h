#ifndef BROADCAST_H
#define BROADCAST_H

#include <stdbool.h>

#include "server.h"

// Broadcast to all clients in a match
void broadcast_to_match(server_t* server, const char* match_id,
                        const char* message);

// Broadcast to all ready players in lobby
void broadcast_to_lobby(server_t* server, const char* message);

// Send to specific user
bool send_to_user(server_t* server, int user_id, const char* message);

// Send to specific client (by fd)
bool send_to_client(server_t* server, int client_fd, const char* message);

// Broadcast to all connected clients
void broadcast_to_all(server_t* server, const char* message);

#endif  // BROADCAST_H
