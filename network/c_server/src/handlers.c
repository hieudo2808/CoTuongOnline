/*
 * handlers.c - Message handlers for all message types
 */

#include "handlers.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "account.h"
#include "broadcast.h"
#include "db.h"
#include "lobby.h"
#include "match.h"
#include "protocol.h"
#include "rating.h"
#include "server.h"
#include "session.h"

// Helper: Send response
static void send_response(server_t* server, client_t* client, int seq, bool success,
                          const char* message, const char* payload) {
    char response[MAX_MESSAGE_SIZE];

    if (payload) {
        snprintf(response, sizeof(response),
                 "{\"type\":\"%s\",\"seq\":%d,\"success\":%s,\"message\":\"%"
                 "s\",\"payload\":%s}\n",
                 success ? "response" : "error", seq,
                 success ? "true" : "false", message ? message : "", payload);
    } else {
        snprintf(
            response, sizeof(response),
            "{\"type\":\"%s\",\"seq\":%d,\"success\":%s,\"message\":\"%s\"}\n",
            success ? "response" : "error", seq, success ? "true" : "false",
            message ? message : "");
    }

    send_to_client(server, client->fd, response);
}

// Helper: Validate token and get user_id
static bool validate_token_and_get_user(const char* token, int* out_user_id) {
    if (!token || !out_user_id) {
        return false;
    }

    return session_validate(token, out_user_id);
}

// Handler: Register
void handle_register(server_t* server, client_t* client, message_t* msg) {
    // Parse payload
    const char* username = json_get_string(msg->payload_json, "username");
    const char* email = json_get_string(msg->payload_json, "email");
    const char* password = json_get_string(msg->payload_json, "password");

    if (!username || !email || !password) {
        send_response(server, client, msg->seq, false, "Missing required fields", NULL);
        return;
    }

    // Check if username/email exists
    if (db_check_username_exists(username)) {
        send_response(server, client, msg->seq, false, "Username already exists", NULL);
        return;
    }

    if (db_check_email_exists(email)) {
        send_response(server, client, msg->seq, false, "Email already exists", NULL);
        return;
    }

    // Create user
    int user_id;
    if (!db_create_user(username, email, password, &user_id)) {
        send_response(server, client, msg->seq, false, "Failed to create user", NULL);
        return;
    }

    // Success
    char payload[256];
    snprintf(payload, sizeof(payload), "{\"user_id\":%d,\"username\":\"%s\"}",
             user_id, username);
    send_response(server, client, msg->seq, true, "Registration successful", payload);

    printf("[Handler] User registered: %s (ID: %d)\n", username, user_id);
}

// Handler: Login
void handle_login(server_t* server, client_t* client, message_t* msg) {
    // Parse payload
    const char* username = json_get_string(msg->payload_json, "username");
    const char* password = json_get_string(msg->payload_json, "password");

    if (!username || !password) {
        send_response(server, client, msg->seq, false, "Missing username or password",
                      NULL);
        return;
    }

    // Verify credentials
    int user_id, rating;
    char password_hash[128];

    if (!db_get_user_by_username(username, &user_id, password_hash, &rating)) {
        send_response(server, client, msg->seq, false, "Invalid username or password",
                      NULL);
        return;
    }

    // Check password (simple comparison - client should hash)
    if (strcmp(password, password_hash) != 0) {
        send_response(server, client, msg->seq, false, "Invalid username or password",
                      NULL);
        return;
    }

    // Create session
    const char* token = session_create(user_id);
    if (!token) {
        send_response(server, client, msg->seq, false, "Failed to create session",
                      NULL);
        return;
    }

    // Update client
    client->user_id = user_id;
    client->authenticated = true;

    // Success
    char payload[512];
    snprintf(
        payload, sizeof(payload),
        "{\"token\":\"%s\",\"user_id\":%d,\"username\":\"%s\",\"rating\":%d}",
        token, user_id, username, rating);
    send_response(server, client, msg->seq, true, "Login successful", payload);

    printf("[Handler] User logged in: %s (ID: %d)\n", username, user_id);
}

// Handler: Logout
void handle_logout(server_t* server, client_t* client, message_t* msg) {
    if (!client->authenticated) {
        send_response(server, client, msg->seq, false, "Not authenticated", NULL);
        return;
    }

    // Destroy session
    if (msg->token) {
        session_destroy(msg->token);
    }

    // Remove from lobby
    lobby_remove_player(client->user_id);

    // Update client
    client->authenticated = false;
    client->user_id = 0;

    send_response(server, client, msg->seq, true, "Logged out", NULL);
    printf("[Handler] User logged out (ID: %d)\n", client->user_id);
}

// Handler: Set Ready
void handle_set_ready(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid or expired token",
                      NULL);
        return;
    }

    // Parse payload
    bool ready = json_get_bool(msg->payload_json, "ready");

    // Get user info
    char username[64];
    int rating;
    if (!db_get_user_by_id(user_id, username, NULL, &rating, NULL, NULL,
                           NULL)) {
        send_response(server, client, msg->seq, false, "User not found", NULL);
        return;
    }

    // Set ready status
    lobby_set_ready(user_id, username, rating, ready);

    // Broadcast updated ready list
    char* ready_list = lobby_get_ready_list_json();
    if (ready_list) {
        char broadcast_msg[8192];
        snprintf(broadcast_msg, sizeof(broadcast_msg),
                 "{\"type\":\"ready_list_update\",\"payload\":%s}\n",
                 ready_list);
        broadcast_to_lobby(server, broadcast_msg);
        free(ready_list);
    }

    send_response(server, client, msg->seq, true, ready ? "Ready set" : "Ready removed",
                  NULL);
}

// Handler: Find Match
void handle_find_match(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid or expired token",
                      NULL);
        return;
    }

    // Parse payload
    const char* mode =
        json_get_string(msg->payload_json, "mode");  // "random" or "rated"
    bool rated = (mode && strcmp(mode, "rated") == 0);

    // Find opponent
    int opponent_id;
    bool found = false;

    if (rated) {
        // Get user rating
        int rating;
        db_get_user_by_id(user_id, NULL, NULL, &rating, NULL, NULL, NULL);
        found = lobby_find_rated_match(user_id, rating, 200, &opponent_id);
    } else {
        found = lobby_find_random_match(user_id, &opponent_id);
    }

    if (!found) {
        send_response(server, client, msg->seq, false, "No opponent found", NULL);
        return;
    }

    // Create match
    char* match_id =
        match_create(user_id, opponent_id, rated, 600000);  // 10 min
    if (!match_id) {
        send_response(server, client, msg->seq, false, "Failed to create match", NULL);
        return;
    }

    // Get usernames
    char user_name[64], opp_name[64];
    db_get_user_by_id(user_id, user_name, NULL, NULL, NULL, NULL, NULL);
    db_get_user_by_id(opponent_id, opp_name, NULL, NULL, NULL, NULL, NULL);

    // Notify both players
    char payload[512];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"red_user\":\"%s\",\"black_user\":\"%s\","
             "\"your_color\":\"%s\"}",
             match_id, user_name, opp_name, "red");
    send_response(server, client, msg->seq, true, "Match found", payload);

    // Notify opponent
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"red_user\":\"%s\",\"black_user\":\"%s\","
             "\"your_color\":\"%s\"}",
             match_id, user_name, opp_name, "black");

    char notify_msg[1024];
    snprintf(notify_msg, sizeof(notify_msg),
             "{\"type\":\"match_found\",\"payload\":%s}\n", payload);
    send_to_user(server, opponent_id, notify_msg);

    free(match_id);
    printf("[Handler] Match created: %s vs %s\n", user_name, opp_name);
}

// Handler: Move
void handle_move(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    // Parse payload
    const char* match_id = json_get_string(msg->payload_json, "match_id");
    int from_row = json_get_int(msg->payload_json, "from_row");
    int from_col = json_get_int(msg->payload_json, "from_col");
    int to_row = json_get_int(msg->payload_json, "to_row");
    int to_col = json_get_int(msg->payload_json, "to_col");

    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    // NOTE: Move validation is done on client side (JavaScript)
    // Server trusts client validation for performance
    // Only check if it's player's turn
    match_t* match = match_find_by_id(match_id);
    if (!match) {
        send_response(server, client, msg->seq, false, "Match not found", NULL);
        return;
    }

    // Check if it's player's turn
    bool is_red_turn = (match->move_count % 2 == 0);
    bool is_red_player = (match->red_user_id == user_id);

    if (is_red_turn != is_red_player) {
        send_response(server, client, msg->seq, false, "Not your turn", NULL);
        return;
    }

    // Add move
    move_t move = {0};
    move.from_row = from_row;
    move.from_col = from_col;
    move.to_row = to_row;
    move.to_col = to_col;
    move.timestamp = time(NULL);

    if (!match_add_move(match_id, &move)) {
        send_response(server, client, msg->seq, false, "Failed to add move", NULL);
        return;
    }

    // Success
    send_response(server, client, msg->seq, true, "Move accepted", NULL);

    // Broadcast move to opponent
    char payload[512];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"from\":{\"row\":%d,\"col\":%d},\"to\":{"
             "\"row\":%d,\"col\":%d}}",
             match_id, from_row, from_col, to_row, to_col);

    char broadcast_msg[1024];
    snprintf(broadcast_msg, sizeof(broadcast_msg),
             "{\"type\":\"opponent_move\",\"payload\":%s}\n", payload);

    broadcast_to_match(server, match_id, broadcast_msg);

    printf("[Handler] Move: %s (%d,%d)->(%d,%d)\n", match_id, from_row,
           from_col, to_row, to_col);
}

// Handler: Resign
void handle_resign(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    // Get match_id
    const char* match_id = json_get_string(msg->payload_json, "match_id");
    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    // Get match
    match_t* match = match_get(match_id);
    if (!match || !match->active) {
        send_response(server, client, msg->seq, false, "Match not found", NULL);
        return;
    }

    // Determine result
    const char* result =
        (user_id == match->red_user_id) ? "black_win" : "red_win";

    // End match
    match_end(match_id, result, "resign");

    // Update ratings
    if (match->rated) {
        int red_rating, black_rating;
        db_get_user_by_id(match->red_user_id, NULL, NULL, &red_rating, NULL,
                          NULL, NULL);
        db_get_user_by_id(match->black_user_id, NULL, NULL, &black_rating, NULL,
                          NULL, NULL);

        rating_change_t rating_change = rating_calculate(red_rating, black_rating, result, DEFAULT_K_FACTOR);
        int red_new = red_rating + rating_change.red_change;
        int black_new = black_rating + rating_change.black_change;

        db_update_user_rating(match->red_user_id, red_new);
        db_update_user_rating(match->black_user_id, black_new);
    }

    // Save to database
    char* moves_json = match_get_moves_json(match);
    char started[32], ended[32];
    sprintf(started, "%ld", match->started_at);
    sprintf(ended, "%ld", time(NULL));
    db_save_match(match_id, match->red_user_id, match->black_user_id, result,
                  moves_json, started, ended);
    free(moves_json);

    // Success
    send_response(server, client, msg->seq, true, "Resigned", NULL);

    // Notify opponent
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"result\":\"%s\"}", match_id, result);
    char notify[512];
    snprintf(notify, sizeof(notify), "{\"type\":\"game_end\",\"payload\":%s}\n",
             payload);
    broadcast_to_match(server, match_id, notify);

    printf("[Handler] Resign: %s, result: %s\n", match_id, result);
}

// Handler: Draw Offer
void handle_draw_offer(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    const char* match_id = json_get_string(msg->payload_json, "match_id");
    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    match_t* match = match_get(match_id);
    if (!match || !match->active) {
        send_response(server, client, msg->seq, false, "Match not found", NULL);
        return;
    }

    // Send to opponent
    int opponent_id = match_get_opponent_id(match, user_id);
    char payload[256];
    snprintf(payload, sizeof(payload), "{\"match_id\":\"%s\"}", match_id);
    char notify[512];
    snprintf(notify, sizeof(notify),
             "{\"type\":\"draw_offer\",\"payload\":%s}\n", payload);
    send_to_user(server, opponent_id, notify);

    send_response(server, client, msg->seq, true, "Draw offer sent", NULL);
}

// Handler: Draw Response
void handle_draw_response(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    const char* match_id = json_get_string(msg->payload_json, "match_id");
    bool accept = json_get_bool(msg->payload_json, "accept");

    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    if (accept) {
        // End match as draw
        match_end(match_id, "draw", "agreement");

        // Notify both
        char payload[256];
        snprintf(payload, sizeof(payload),
                 "{\"match_id\":\"%s\",\"result\":\"draw\"}", match_id);
        char notify[512];
        snprintf(notify, sizeof(notify),
                 "{\"type\":\"game_end\",\"payload\":%s}\n", payload);
        broadcast_to_match(server, match_id, notify);

        send_response(server, client, msg->seq, true, "Draw accepted", NULL);
    } else {
        send_response(server, client, msg->seq, true, "Draw declined", NULL);
    }
}

// Handler: Challenge
void handle_challenge(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    int opponent_id = json_get_int(msg->payload_json, "opponent_id");
    bool rated = json_get_bool(msg->payload_json, "rated");

    if (opponent_id <= 0) {
        send_response(server, client, msg->seq, false, "Invalid opponent_id", NULL);
        return;
    }

    // Create challenge
    char* challenge_id = lobby_create_challenge(user_id, opponent_id, rated);
    if (!challenge_id) {
        send_response(server, client, msg->seq, false, "Failed to create challenge",
                      NULL);
        return;
    }

    // Notify opponent
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"challenge_id\":\"%s\",\"from_user_id\":%d,\"rated\":%s}",
             challenge_id, user_id, rated ? "true" : "false");
    char notify[512];
    snprintf(notify, sizeof(notify),
             "{\"type\":\"challenge_received\",\"payload\":%s}\n", payload);
    send_to_user(server, opponent_id, notify);

    // Response
    char resp_payload[256];
    snprintf(resp_payload, sizeof(resp_payload), "{\"challenge_id\":\"%s\"}",
             challenge_id);
    send_response(server, client, msg->seq, true, "Challenge sent", resp_payload);

    free(challenge_id);
}

// Handler: Challenge Response
void handle_challenge_response(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    const char* challenge_id = json_get_string(msg->payload_json, "challenge_id");
    bool accept = json_get_bool(msg->payload_json, "accept");

    if (!challenge_id) {
        send_response(server, client, msg->seq, false, "Missing challenge_id", NULL);
        return;
    }

    if (accept) {
        if (!lobby_accept_challenge(challenge_id, user_id)) {
            send_response(server, client, msg->seq, false, "Failed to accept challenge",
                          NULL);
            return;
        }

        // Get challenge
        challenge_t* ch = lobby_get_challenge(challenge_id);
        if (!ch) {
            send_response(server, client, msg->seq, false, "Challenge not found", NULL);
            return;
        }

        // Create match
        char* match_id =
            match_create(ch->from_user_id, ch->to_user_id, ch->rated, 600000);
        if (!match_id) {
            send_response(server, client, msg->seq, false, "Failed to create match",
                          NULL);
            return;
        }

        // Notify both
        char payload[512];
        snprintf(payload, sizeof(payload), "{\"match_id\":\"%s\"}", match_id);
        char notify[1024];
        snprintf(notify, sizeof(notify),
                 "{\"type\":\"match_start\",\"payload\":%s}\n", payload);
        send_to_user(server, ch->from_user_id, notify);
        send_to_user(server, ch->to_user_id, notify);

        send_response(server, client, msg->seq, true, "Challenge accepted", payload);
        free(match_id);
    } else {
        lobby_decline_challenge(challenge_id, user_id);
        send_response(server, client, msg->seq, true, "Challenge declined", NULL);
    }
}

// Handler: Get Match
void handle_get_match(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    const char* match_id = json_get_string(msg->payload_json, "match_id");
    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    char match_json[65536];
    if (!db_get_match(match_id, match_json, sizeof(match_json))) {
        send_response(server, client, msg->seq, false, "Match not found", NULL);
        return;
    }

    send_response(server, client, msg->seq, true, "Match found", match_json);
}

// Handler: Leaderboard
void handle_leaderboard(server_t* server, client_t* client, message_t* msg) {
    int limit = json_get_int(msg->payload_json, "limit");
    int offset = json_get_int(msg->payload_json, "offset");

    if (limit <= 0) limit = 10;
    if (offset < 0) offset = 0;

    char leaderboard_json[16384];
    if (!db_get_leaderboard(limit, offset, leaderboard_json,
                            sizeof(leaderboard_json))) {
        send_response(server, client, msg->seq, false, "Failed to get leaderboard",
                      NULL);
        return;
    }

    send_response(server, client, msg->seq, true, "Leaderboard", leaderboard_json);
}

// Handler: Heartbeat
void handle_heartbeat(server_t* server, client_t* client, message_t* msg) {
    send_response(server, client, msg->seq, true, "pong", NULL);
}

// Handler: Chat Message
void handle_chat_message(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    const char* token = json_get_string(msg->payload_json, "token");
    int user_id;
    if (!validate_token_and_get_user(token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    // Get message and match_id
    const char* message = json_get_string(msg->payload_json, "message");
    const char* match_id = json_get_string(msg->payload_json, "match_id");

    if (!message || !match_id) {
        send_response(server, client, msg->seq, false, "Missing message or match_id",
                      NULL);
        return;
    }

    // Validate message length (max 500 chars)
    if (strlen(message) > 500) {
        send_response(server, client, msg->seq, false,
                      "Message too long (max 500 chars)", NULL);
        return;
    }

    // Get match to find opponent
    match_t* match = match_get(match_id);
    if (!match) {
        send_response(server, client, msg->seq, false, "Match not found", NULL);
        return;
    }

    // Verify user is in this match
    if (match->red_user_id != user_id && match->black_user_id != user_id) {
        send_response(server, client, msg->seq, false, "Not in this match", NULL);
        return;
    }

    // Get sender username from database
    char username[64] = {0};
    if (!db_get_username(user_id, username, sizeof(username))) {
        strcpy(username, "Unknown");
    }

    // Broadcast chat message to both players
    char chat_payload[1024];
    snprintf(chat_payload, sizeof(chat_payload),
             "{\"match_id\":\"%s\",\"user_id\":%d,\"username\":\"%s\",\"message\":"
             "\"%s\",\"timestamp\":%ld}",
             match_id, user_id, username, message, (long)time(NULL));

    char notification[MAX_MESSAGE_SIZE];
    snprintf(notification, sizeof(notification),
             "{\"type\":\"chat_message\",\"payload\":%s}\n", chat_payload);

    // Send to red player
    client_t* red_client =
        server_get_client_by_user_id(server, match->red_user_id);
    if (red_client) {
        send_to_client(server, red_client->fd, notification);
    }

    // Send to black player
    client_t* black_client =
        server_get_client_by_user_id(server, match->black_user_id);
    if (black_client) {
        send_to_client(server, black_client->fd, notification);
    }

    // Acknowledge to sender
    send_response(server, client, msg->seq, true, "Message sent", NULL);

    printf("[Handler] Chat message from user %d in match %s\n", user_id,
           match_id);
}

// Dispatcher: Route message to appropriate handler
void dispatch_handler(server_t* server, client_t* client, message_t* msg) {
    if (!msg->type) {
        fprintf(stderr, "[Dispatcher] No message type\n");
        return;
    }

    printf("[Dispatcher] Type: %s, Seq: %d, User: %d\n", msg->type, msg->seq,
           client->user_id);

    if (strcmp(msg->type, "register") == 0) {
        handle_register(server, client, msg);
    } else if (strcmp(msg->type, "login") == 0) {
        handle_login(server, client, msg);
    } else if (strcmp(msg->type, "logout") == 0) {
        handle_logout(server, client, msg);
    } else if (strcmp(msg->type, "set_ready") == 0) {
        handle_set_ready(server, client, msg);
    } else if (strcmp(msg->type, "find_match") == 0) {
        handle_find_match(server, client, msg);
    } else if (strcmp(msg->type, "move") == 0) {
        handle_move(server, client, msg);
    } else if (strcmp(msg->type, "resign") == 0) {
        handle_resign(server, client, msg);
    } else if (strcmp(msg->type, "draw_offer") == 0) {
        handle_draw_offer(server, client, msg);
    } else if (strcmp(msg->type, "draw_response") == 0) {
        handle_draw_response(server, client, msg);
    } else if (strcmp(msg->type, "challenge") == 0) {
        handle_challenge(server, client, msg);
    } else if (strcmp(msg->type, "challenge_response") == 0) {
        handle_challenge_response(server, client, msg);
    } else if (strcmp(msg->type, "get_match") == 0) {
        handle_get_match(server, client, msg);
    } else if (strcmp(msg->type, "leaderboard") == 0) {
        handle_leaderboard(server, client, msg);
    } else if (strcmp(msg->type, "heartbeat") == 0) {
        handle_heartbeat(server, client, msg);
    } else if (strcmp(msg->type, "chat_message") == 0) {
        handle_chat_message(server, client, msg);
    } else {
        fprintf(stderr, "[Dispatcher] Unknown message type: %s\n", msg->type);
        send_response(server, client, msg->seq, false, "Unknown message type", NULL);
    }
}
