#ifndef HANDLERS_H
#define HANDLERS_H

#include "protocol.h"
#include "server.h"

// Message handlers
void handle_register(server_t* server, client_t* client, message_t* msg);
void handle_login(server_t* server, client_t* client, message_t* msg);
void handle_logout(server_t* server, client_t* client, message_t* msg);
void handle_set_ready(server_t* server, client_t* client, message_t* msg);
void handle_find_match(server_t* server, client_t* client, message_t* msg);
void handle_move(server_t* server, client_t* client, message_t* msg);
void handle_resign(server_t* server, client_t* client, message_t* msg);
void handle_draw_offer(server_t* server, client_t* client, message_t* msg);
void handle_draw_response(server_t* server, client_t* client, message_t* msg);
void handle_challenge(server_t* server, client_t* client, message_t* msg);
void handle_challenge_response(server_t* server, client_t* client, message_t* msg);
void handle_get_match(server_t* server, client_t* client, message_t* msg);
void handle_leaderboard(server_t* server, client_t* client, message_t* msg);
void handle_heartbeat(server_t* server, client_t* client, message_t* msg);
void handle_chat_message(server_t* server, client_t* client, message_t* msg);

// Handler dispatcher
void dispatch_handler(server_t* server, client_t* client, message_t* msg);

#endif  // HANDLERS_H
