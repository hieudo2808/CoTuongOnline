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

// Helper: Escape JSON string (prevent injection)
static void escape_json_string(const char* src, char* dst, size_t dst_size) {
    if (!src) {
        dst[0] = '\0';
        return;
    }
    
    char* d = dst;
    const char* s = src;
    size_t remaining = dst_size - 1;
    
    while (*s && remaining > 1) {
        if (*s == '"') {
            if (remaining < 2) break;
            *d++ = '\\';
            *d++ = '"';
            remaining -= 2;
        } else if (*s == '\\') {
            if (remaining < 2) break;
            *d++ = '\\';
            *d++ = '\\';
            remaining -= 2;
        } else if (*s == '\n') {
            if (remaining < 2) break;
            *d++ = '\\';
            *d++ = 'n';
            remaining -= 2;
        } else if (*s == '\r') {
            if (remaining < 2) break;
            *d++ = '\\';
            *d++ = 'r';
            remaining -= 2;
        } else {
            *d++ = *s;
            remaining--;
        }
        s++;
    }
    *d = '\0';
}

// Helper: Send response
static void send_response(server_t* server, client_t* client, int seq, bool success,
                          const char* message, const char* payload) {
    char response[MAX_MESSAGE_SIZE];
    char escaped_msg[512];
    
    // Escape message to prevent JSON injection
    escape_json_string(message, escaped_msg, sizeof(escaped_msg));

    if (payload) {
        snprintf(response, sizeof(response),
                 "{\"type\":\"%s\",\"seq\":%d,\"success\":%s,\"message\":\"%s\",\"payload\":%s}\n",
                 success ? "response" : "error", seq,
                 success ? "true" : "false", escaped_msg, payload);
    } else {
        snprintf(
            response, sizeof(response),
            "{\"type\":\"%s\",\"seq\":%d,\"success\":%s,\"message\":\"%s\"}\n",
            success ? "response" : "error", seq, success ? "true" : "false",
            escaped_msg);
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

    // Log mapping of user -> client fd for debugging
    printf("[Handler] User logged in: %s (ID: %d, fd=%d)\n", username, user_id, client->fd);
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
    // Attach authenticated user to current client mapping so server can send
    // notifications back to this connection (in case of reconnects)
    client->user_id = user_id;
    client->authenticated = true;

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
    client->user_id = user_id;
    client->authenticated = true;

    // Debug log: incoming find_match
    printf("[Handler] handle_find_match called: user_id=%d, seq=%d\n", user_id, msg->seq);

    // Parse payload
    const char* mode =
        json_get_string(msg->payload_json, "mode");  // "random" or "rated"
    bool rated = (mode && strcmp(mode, "rated") == 0);

    // Ensure the requesting player is marked ready (in case client didn't call set_ready)
    {
        char username[64];
        int rating;
        if (db_get_user_by_id(user_id, username, NULL, &rating, NULL, NULL, NULL)) {
            lobby_set_ready(user_id, username, rating, true);
            printf("[Handler] Marked user_id=%d as ready (auto)\n", user_id);
            // Broadcast updated ready list so other clients see the new player
            char* ready_list = lobby_get_ready_list_json();
            if (ready_list) {
                char broadcast_msg[8192];
                snprintf(broadcast_msg, sizeof(broadcast_msg),
                         "{\"type\":\"ready_list_update\",\"payload\":%s}\n",
                         ready_list);
                broadcast_to_lobby(server, broadcast_msg);
                free(ready_list);
            }
        } else {
            printf("[Handler] Warning: failed to lookup user %d before queuing\n", user_id);
        }
    }

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
        // No opponent available right now — respond with queued status. Client
        // UI should treat this as searching and wait for a subsequent
        // 'match_found' broadcast when another player becomes available.
        printf("[Handler] No opponent currently for user_id=%d — player queued\n", user_id);
        send_response(server, client, msg->seq, true, "Queued for match", "{\"status\":\"queued\"}");
        return;
    }

    // Create match
    // Before creating a match ensure both users are currently connected.
    if (!is_user_connected(server, user_id)) {
        printf("[Handler] Aborting match: requester user_id=%d not connected\n", user_id);
        send_response(server, client, msg->seq, false, "You are not connected", NULL);
        return;
    }
    if (!is_user_connected(server, opponent_id)) {
        // Opponent disconnected between queue and match - keep requester queued.
        printf("[Handler] Opponent %d not connected; keeping user %d queued\n", opponent_id, user_id);
        send_response(server, client, msg->seq, true, "Queued for match", "{\"status\":\"queued\"}");
        // Remove the disconnected opponent from ready list if present
        lobby_remove_player(opponent_id);
        return;
    }

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
        char payload_a[512];
        char payload_b[512];

        // Payload for the requester (user_id) - your_color = red
        snprintf(payload_a, sizeof(payload_a),
             "{\"match_id\":\"%s\",\"red_user\":\"%s\",\"black_user\":\"%s\",\"your_color\":\"%s\"}",
             match_id, user_name, opp_name, "red");

        // Payload for the opponent - your_color = black
        snprintf(payload_b, sizeof(payload_b),
             "{\"match_id\":\"%s\",\"red_user\":\"%s\",\"black_user\":\"%s\",\"your_color\":\"%s\"}",
             match_id, user_name, opp_name, "black");

        // Build match_found messages
        char notify_a[1024];
        char notify_b[1024];
        snprintf(notify_a, sizeof(notify_a), "{\"type\":\"match_found\",\"payload\":%s}\n", payload_a);
        snprintf(notify_b, sizeof(notify_b), "{\"type\":\"match_found\",\"payload\":%s}\n", payload_b);

        // Send match_found to both players
        bool sent_a = send_to_user(server, user_id, notify_a);
        bool sent_b = send_to_user(server, opponent_id, notify_b);

        // If sending failed for either side, rollback the match and requeue any still-connected player
        if (!sent_a || !sent_b) {
            printf("[Handler] Warning: match notify failed (sent_a=%d, sent_b=%d). Rolling back match %s\n", sent_a, sent_b, match_id);
            // Mark match as ended/aborted
            match_end(match_id, "aborted", "notify_failed");

            // Requeue connected players (so they remain in ready list)
            int rating_a = 0, rating_b = 0;
            db_get_user_by_id(user_id, NULL, NULL, &rating_a, NULL, NULL, NULL);
            db_get_user_by_id(opponent_id, NULL, NULL, &rating_b, NULL, NULL, NULL);

            if (is_user_connected(server, user_id)) {
                lobby_set_ready(user_id, user_name, rating_a, true);
            }
            if (is_user_connected(server, opponent_id)) {
                lobby_set_ready(opponent_id, opp_name, rating_b, true);
            }

            // Inform requester that they're queued again
            send_response(server, client, msg->seq, true, "Queued for match", "{\"status\":\"queued\"}");

            free(match_id);
            return;
        }

        // Also respond to the requester for the original request seq (backwards compatibility)
        send_response(server, client, msg->seq, true, "Match found", payload_a);

        free(match_id);
        printf("[Handler] Match created: %s vs %s (sent to user %d: %d, opponent %d: %d)\n",
             user_name, opp_name, user_id, sent_a, opponent_id, sent_b);
}

// Handler: Move
void handle_move(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }
    client->user_id = user_id;
    client->authenticated = true;
    client->user_id = user_id;
    client->authenticated = true;
    client->user_id = user_id;
    client->authenticated = true;

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

    // Send move to opponent only (not to the sender)
    char payload[512];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"from\":{\"row\":%d,\"col\":%d},\"to\":{"
             "\"row\":%d,\"col\":%d}}",
             match_id, from_row, from_col, to_row, to_col);

    char broadcast_msg[1024];
    snprintf(broadcast_msg, sizeof(broadcast_msg),
             "{\"type\":\"opponent_move\",\"payload\":%s}\n", payload);

    // Get opponent user_id
    int opponent_id = (match->red_user_id == user_id) ? match->black_user_id : match->red_user_id;
    send_to_user(server, opponent_id, broadcast_msg);

    printf("[Handler] Move: %s (%d,%d)->(%d,%d)\n", match_id, from_row,
           from_col, to_row, to_col);
}

void handle_resign(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }
    client->user_id = user_id;
    client->authenticated = true;

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

    // Xác định kết quả: Người gửi lệnh resign là người thua
    const char* result = (user_id == match->red_user_id) ? "black_wins" : "red_wins";

    // Kết thúc trận đấu
    match_end(match_id, result, "resign");

    // Biến để gửi về client
    int new_red_rating = 0;
    int new_black_rating = 0;

    // Cập nhật Elo và Stats (Chỉ khi đấu Rank)
    if (match->rated) {
        char u1[64], e1[128]; int r1, w1, l1, d1; // Red
        char u2[64], e2[128]; int r2, w2, l2, d2; // Black

        // Lấy thông tin hiện tại
        db_get_user_by_id(match->red_user_id, u1, e1, &r1, &w1, &l1, &d1);
        db_get_user_by_id(match->black_user_id, u2, e2, &r2, &w2, &l2, &d2);

        // Tính toán Elo mới
        rating_change_t rc = rating_calculate(r1, r2, result, DEFAULT_K_FACTOR);
        
        new_red_rating = r1 + rc.red_change;
        new_black_rating = r2 + rc.black_change;

        // Cập nhật số trận Thắng/Thua
        if (strcmp(result, "red_wins") == 0) {
            w1++; // Red thắng
            l2++; // Black thua
        } else {
            l1++; // Red thua
            w2++; // Black thắng
        }

        // Lưu vào Database
        db_update_user_rating(match->red_user_id, new_red_rating);
        db_update_user_stats(match->red_user_id, w1, l1, d1);
        
        db_update_user_rating(match->black_user_id, new_black_rating);
        db_update_user_stats(match->black_user_id, w2, l2, d2);
        
        printf("[Rating] Resign: Red(%d->%d), Black(%d->%d)\n", r1, new_red_rating, r2, new_black_rating);
    }

    // Lưu lịch sử trận đấu
    char* moves_json = match_get_moves_json(match);
    char started[32], ended[32];
    sprintf(started, "%ld", match->started_at);
    sprintf(ended, "%ld", time(NULL));
    db_save_match(match_id, match->red_user_id, match->black_user_id, result,
                  moves_json, started, ended);
    free(moves_json);

    // Phản hồi cho người gửi (đã xử lý xong)
    send_response(server, client, msg->seq, true, "Resigned", NULL);

    // Gửi Broadcast kết quả cho cả 2 người chơi (kèm Rating mới)
    char payload[512];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"result\":\"%s\",\"red_rating\":%d,\"black_rating\":%d}", 
             match_id, result, new_red_rating, new_black_rating);
             
    char notify[1024];
    snprintf(notify, sizeof(notify), "{\"type\":\"game_end\",\"payload\":%s}\n",
             payload);
    broadcast_to_match(server, match_id, notify);
}

// Handler: Draw Offer
void handle_draw_offer(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }
    client->user_id = user_id;
    client->authenticated = true;

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

void handle_draw_response(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }
    client->user_id = user_id;
    client->authenticated = true;

    const char* match_id = json_get_string(msg->payload_json, "match_id");
    bool accept = json_get_bool(msg->payload_json, "accept");

    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    if (accept) {
        match_t* match = match_get(match_id);
        if (!match || !match->active) {
             send_response(server, client, msg->seq, false, "Match not found or ended", NULL);
             return;
        }

        match_end(match_id, "draw", "agreement");

        int new_red_rating = 0;
        int new_black_rating = 0;

        if (match->rated) {
            char u1[64], e1[128]; int r1, w1, l1, d1;
            char u2[64], e2[128]; int r2, w2, l2, d2;

            db_get_user_by_id(match->red_user_id, u1, e1, &r1, &w1, &l1, &d1);
            db_get_user_by_id(match->black_user_id, u2, e2, &r2, &w2, &l2, &d2);

            rating_change_t rc = rating_calculate(r1, r2, "draw", DEFAULT_K_FACTOR);
            
            new_red_rating = r1 + rc.red_change;
            new_black_rating = r2 + rc.black_change;

            d1++;
            d2++;
            db_update_user_rating(match->red_user_id, new_red_rating);
            db_update_user_stats(match->red_user_id, w1, l1, d1);

            db_update_user_rating(match->black_user_id, new_black_rating);
            db_update_user_stats(match->black_user_id, w2, l2, d2);
            
            printf("[Rating] Draw: Red(%d->%d), Black(%d->%d)\n", r1, new_red_rating, r2, new_black_rating);
        }

        char* moves_json = match_get_moves_json(match);
        char started[32], ended[32];
        sprintf(started, "%ld", match->started_at);
        sprintf(ended, "%ld", time(NULL));
        db_save_match(match_id, match->red_user_id, match->black_user_id, "draw",
                      moves_json, started, ended);
        free(moves_json);

        char payload[512];
        snprintf(payload, sizeof(payload), 
                 "{\"match_id\":\"%s\",\"result\":\"draw\",\"red_rating\":%d,\"black_rating\":%d}", 
                 match_id, new_red_rating, new_black_rating);
                 
        char notify[1024];
        snprintf(notify, sizeof(notify), "{\"type\":\"game_end\",\"payload\":%s}\n", payload);
        broadcast_to_match(server, match_id, notify);

        send_response(server, client, msg->seq, true, "Draw accepted", NULL);
    } else {
        // Từ chối hòa
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
    client->user_id = user_id;
    client->authenticated = true;

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

void handle_leaderboard(server_t* server, client_t* client, message_t* msg) {
    if (!msg->payload_json) {
        send_response(server, client, msg->seq, false, "Invalid request payload", NULL);
        return;
    }

    int limit = json_get_int(msg->payload_json, "limit");
    int offset = json_get_int(msg->payload_json, "offset");

    if (limit <= 0) limit = 10;
    if (offset < 0) offset = 0;

    size_t buffer_size = 16384;
    char* leaderboard_json = (char*)malloc(buffer_size);
    
    if (!leaderboard_json) {
        perror("malloc failed in handle_leaderboard");
        send_response(server, client, msg->seq, false, "Server memory error", NULL);
        return;
    }

    if (!db_get_leaderboard(limit, offset, leaderboard_json, buffer_size)) {
        send_response(server, client, msg->seq, false, "Failed to get leaderboard", NULL);
        free(leaderboard_json);
        return;
    }

    send_response(server, client, msg->seq, true, "Leaderboard", leaderboard_json);
    free(leaderboard_json);
}

// Handler: Join Match (used when reconnecting to associate connection with user)
void handle_join_match(server_t* server, client_t* client, message_t* msg) {
    // Validate token
    int user_id;
    if (!validate_token_and_get_user(msg->token, &user_id)) {
        send_response(server, client, msg->seq, false, "Invalid token", NULL);
        return;
    }

    // Associate this connection with user
    client->user_id = user_id;
    client->authenticated = true;

    const char* match_id = json_get_string(msg->payload_json, "match_id");
    if (!match_id) {
        send_response(server, client, msg->seq, false, "Missing match_id", NULL);
        return;
    }

    // Get match
    match_t* match = match_find_by_id(match_id);
    if (!match || !match->active) {
        send_response(server, client, msg->seq, false, "Match not found or ended", NULL);
        return;
    }

    // Check if user is part of this match
    if (match->red_user_id != user_id && match->black_user_id != user_id) {
        send_response(server, client, msg->seq, false, "Not a player in this match", NULL);
        return;
    }

    // Determine whose turn it is
    bool is_red_turn = (match->move_count % 2 == 0);
    const char* current_turn = is_red_turn ? "red" : "black";
    bool is_my_turn = (is_red_turn && match->red_user_id == user_id) ||
                      (!is_red_turn && match->black_user_id == user_id);

    // Return match state
    char payload[512];
    snprintf(payload, sizeof(payload),
             "{\"match_id\":\"%s\",\"move_count\":%d,\"current_turn\":\"%s\",\"is_my_turn\":%s}",
             match_id, match->move_count, current_turn, is_my_turn ? "true" : "false");

    send_response(server, client, msg->seq, true, "Joined match", payload);

    printf("[Handler] User %d joined match %s (move_count=%d, is_my_turn=%d)\n",
           user_id, match_id, match->move_count, is_my_turn);
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
    } else if (strcmp(msg->type, "join_match") == 0) {
        handle_join_match(server, client, msg);
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
