/*
 * match.c - Match management
 * TEMPLATE - Needs full implementation
 */

#include "match.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static match_t matches[MAX_MATCHES];
static int match_count = 0;

// Pending timeouts to broadcast
static timeout_info_t pending_timeouts[MAX_MATCHES];
static int pending_timeout_count = 0;

// Initialize match manager
bool match_init(void) {
    memset(matches, 0, sizeof(matches));
    memset(pending_timeouts, 0, sizeof(pending_timeouts));
    match_count = 0;
    pending_timeout_count = 0;
    printf("Match manager initialized\n");
    return true;
}

// Shutdown
void match_shutdown(void) { match_count = 0; pending_timeout_count = 0; }

// Create new match
char* match_create(int red_user_id, int black_user_id, bool rated,
                   int time_ms) {
    if (match_count >= MAX_MATCHES) {
        return NULL;
    }

    // Find empty slot
    match_t* match = NULL;
    for (int i = 0; i < MAX_MATCHES; i++) {
        if (!matches[i].active && matches[i].match_id[0] == '\0') {
            match = &matches[i];
            match_count++;
            break;
        }
    }

    if (!match) return NULL;

    // Initialize match
    sprintf(match->match_id, "match_%d_%ld", match_count, time(NULL));
    match->red_user_id = red_user_id;
    match->black_user_id = black_user_id;
    strcpy(match->current_turn, "red");
    match->move_count = 0;
    match->rated = rated;
    match->red_time_ms = time_ms;
    match->black_time_ms = time_ms;
    match->started_at = time(NULL);
    match->last_move_at = time(NULL);
    match->active = true;
    strcpy(match->result, "ongoing");

    return strdup(match->match_id);
}

// Get match
match_t* match_get(const char* match_id) {
    for (int i = 0; i < MAX_MATCHES; i++) {
        if (strcmp(matches[i].match_id, match_id) == 0) {
            return &matches[i];
        }
    }
    return NULL;
}

// Validate position
bool is_valid_position(int row, int col) {
    return (row >= 0 && row <= 9 && col >= 0 && col <= 8);
}

// Check if correct turn
bool is_correct_turn(match_t* match, int user_id) {
    if (strcmp(match->current_turn, "red") == 0) {
        return (user_id == match->red_user_id);
    } else {
        return (user_id == match->black_user_id);
    }
}

// Validate move (basic sanity check)
bool match_validate_move(const char* match_id, int user_id, int from_row,
                         int from_col, int to_row, int to_col) {
    match_t* match = match_get(match_id);
    if (!match || !match->active) return false;

    // Check turn
    if (!is_correct_turn(match, user_id)) return false;

    // Check positions
    if (!is_valid_position(from_row, from_col) ||
        !is_valid_position(to_row, to_col)) {
        return false;
    }

    // Basic sanity: from != to
    if (from_row == to_row && from_col == to_col) return false;

    return true;
}

// Add move
bool match_add_move(const char* match_id, const move_t* move) {
    match_t* match = match_get(match_id);
    if (!match || !match->active) return false;

    if (match->move_count >= MAX_MOVES_PER_MATCH) return false;

    match->moves[match->move_count++] = *move;
    match->last_move_at = time(NULL);

    // Switch turn
    if (strcmp(match->current_turn, "red") == 0) {
        strcpy(match->current_turn, "black");
    } else {
        strcpy(match->current_turn, "red");
    }

    return true;
}

// End match
bool match_end(const char* match_id, const char* result, const char* reason) {
    match_t* match = match_get(match_id);
    if (!match) return false;

    match->active = false;
    strncpy(match->result, result, 15);
    strncpy(match->end_reason, reason, 31);

    return true;
}

// Get match as JSON
char* match_get_json(const char* match_id) {
    match_t* match = match_get(match_id);
    if (!match) return NULL;

    char* json = malloc(65536);  // Large buffer for moves
    if (!json) return NULL;

    char* ptr = json;

    ptr += sprintf(ptr, "{\"match_id\":\"%s\",", match->match_id);
    ptr += sprintf(ptr, "\"red_user_id\":%d,", match->red_user_id);
    ptr += sprintf(ptr, "\"black_user_id\":%d,", match->black_user_id);
    ptr += sprintf(ptr, "\"red_time_ms\":%d,", match->red_time_ms);
    ptr += sprintf(ptr, "\"black_time_ms\":%d,", match->black_time_ms);
    ptr += sprintf(ptr, "\"result\":\"%s\",", match->result);
    ptr += sprintf(ptr, "\"moves\":[");

    for (int i = 0; i < match->move_count; i++) {
        if (i > 0) ptr += sprintf(ptr, ",");
        ptr += sprintf(ptr,
                       "{\"move_id\":%d,\"from\":{\"row\":%d,\"col\":%d},"
                       "\"to\":{\"row\":%d,\"col\":%d}}",
                       match->moves[i].move_id, match->moves[i].from_row,
                       match->moves[i].from_col, match->moves[i].to_row,
                       match->moves[i].to_col);
    }

    sprintf(ptr, "]}");

    return json;
}

// Find match by ID
match_t* match_find_by_id(const char* match_id) { return match_get(match_id); }

// Find match by user
match_t* match_find_by_user(int user_id) {
    for (int i = 0; i < MAX_MATCHES; i++) {
        if (matches[i].active && (matches[i].red_user_id == user_id ||
                                  matches[i].black_user_id == user_id)) {
            return &matches[i];
        }
    }
    return NULL;
}

// Check if move causes checkmate (stub - needs full chess logic)
bool match_is_checkmate(match_t* match) {
    (void)match;  // Will be used when implementing checkmate detection
    
    // TODO: Implement full checkmate detection
    // For now, return false (will be handled by JavaScript client)
    return false;
}

// Get opponent ID
int match_get_opponent_id(const match_t* match, int user_id) {
    if (match->red_user_id == user_id) {
        return match->black_user_id;
    } else {
        return match->red_user_id;
    }
}

// Get move history as JSON
char* match_get_moves_json(const match_t* match) {
    if (!match) return NULL;

    char* json = malloc(32768);
    if (!json) return NULL;

    char* ptr = json;
    ptr += sprintf(ptr, "[");

    for (int i = 0; i < match->move_count; i++) {
        if (i > 0) ptr += sprintf(ptr, ",");
        ptr += sprintf(ptr,
                       "{\"from\":{\"row\":%d,\"col\":%d},"
                       "\"to\":{\"row\":%d,\"col\":%d}}",
                       match->moves[i].from_row, match->moves[i].from_col,
                       match->moves[i].to_row, match->moves[i].to_col);
    }

    sprintf(ptr, "]");
    return json;
}

// Add spectator to match
bool match_add_spectator(const char* match_id, int user_id) {
    match_t* match = match_get(match_id);
    if (!match || !match->active) return false;
    
    // Check if already a spectator
    for (int i = 0; i < match->spectator_count; i++) {
        if (match->spectator_ids[i] == user_id) {
            return true;  // Already spectating
        }
    }
    
    // Check if room for more spectators
    if (match->spectator_count >= MAX_SPECTATORS_PER_MATCH) {
        return false;
    }
    
    // Add spectator
    match->spectator_ids[match->spectator_count++] = user_id;
    return true;
}

// Remove spectator from match
bool match_remove_spectator(const char* match_id, int user_id) {
    match_t* match = match_get(match_id);
    if (!match) return false;
    
    for (int i = 0; i < match->spectator_count; i++) {
        if (match->spectator_ids[i] == user_id) {
            // Shift remaining spectators
            for (int j = i; j < match->spectator_count - 1; j++) {
                match->spectator_ids[j] = match->spectator_ids[j + 1];
            }
            match->spectator_count--;
            return true;
        }
    }
    return false;
}

// Check if user is spectator
bool match_is_spectator(const match_t* match, int user_id) {
    if (!match) return false;
    
    for (int i = 0; i < match->spectator_count; i++) {
        if (match->spectator_ids[i] == user_id) {
            return true;
        }
    }
    return false;
}

// Get list of active matches for spectating
char* match_get_live_matches_json(void) {
    char* json = malloc(65536);
    if (!json) return NULL;
    
    char* ptr = json;
    ptr += sprintf(ptr, "[");
    
    int first = 1;
    for (int i = 0; i < MAX_MATCHES; i++) {
        if (matches[i].active) {
            if (!first) ptr += sprintf(ptr, ",");
            first = 0;
            
            ptr += sprintf(ptr, 
                "{\"match_id\":\"%s\","
                "\"red_user_id\":%d,"
                "\"black_user_id\":%d,"
                "\"move_count\":%d,"
                "\"spectator_count\":%d,"
                "\"current_turn\":\"%s\","
                "\"started_at\":%ld}",
                matches[i].match_id,
                matches[i].red_user_id,
                matches[i].black_user_id,
                matches[i].move_count,
                matches[i].spectator_count,
                matches[i].current_turn,
                (long)matches[i].started_at);
        }
    }
    
    sprintf(ptr, "]");
    return json;
}

// Update timer - deduct time from current player since last move
bool match_update_timer(const char* match_id) {
    match_t* match = match_get(match_id);
    if (!match || !match->active) return false;
    
    time_t now = time(NULL);
    int elapsed_ms = (int)((now - match->last_move_at) * 1000);
    
    if (strcmp(match->current_turn, "red") == 0) {
        match->red_time_ms -= elapsed_ms;
        if (match->red_time_ms < 0) match->red_time_ms = 0;
    } else {
        match->black_time_ms -= elapsed_ms;
        if (match->black_time_ms < 0) match->black_time_ms = 0;
    }
    
    match->last_move_at = now;
    return true;
}

// Check if current player has timed out
bool match_check_timeout(const char* match_id) {
    match_t* match = match_get(match_id);
    if (!match || !match->active) return false;
    
    time_t now = time(NULL);
    int elapsed_ms = (int)((now - match->last_move_at) * 1000);
    
    if (strcmp(match->current_turn, "red") == 0) {
        return (match->red_time_ms - elapsed_ms) <= 0;
    } else {
        return (match->black_time_ms - elapsed_ms) <= 0;
    }
}

// Get current timer state as JSON
char* match_get_timer_json(const char* match_id) {
    match_t* match = match_get(match_id);
    if (!match) return NULL;
    
    time_t now = time(NULL);
    int elapsed_ms = (int)((now - match->last_move_at) * 1000);
    
    int red_remaining = match->red_time_ms;
    int black_remaining = match->black_time_ms;
    
    // Deduct elapsed time from current player
    if (match->active) {
        if (strcmp(match->current_turn, "red") == 0) {
            red_remaining -= elapsed_ms;
            if (red_remaining < 0) red_remaining = 0;
        } else {
            black_remaining -= elapsed_ms;
            if (black_remaining < 0) black_remaining = 0;
        }
    }
    
    char* json = malloc(256);
    if (!json) return NULL;
    
    sprintf(json, 
        "{\"match_id\":\"%s\","
        "\"red_time_ms\":%d,"
        "\"black_time_ms\":%d,"
        "\"current_turn\":\"%s\","
        "\"active\":%s}",
        match->match_id,
        red_remaining,
        black_remaining,
        match->current_turn,
        match->active ? "true" : "false");
    
    return json;
}

// Check all active matches for timeouts (called periodically)
void match_check_all_timeouts(void) {
    time_t now = time(NULL);
    
    for (int i = 0; i < MAX_MATCHES; i++) {
        if (matches[i].active) {
            int elapsed_ms = (int)((now - matches[i].last_move_at) * 1000);
            
            bool timeout = false;
            const char* winner;
            
            if (strcmp(matches[i].current_turn, "red") == 0) {
                if (matches[i].red_time_ms - elapsed_ms <= 0) {
                    timeout = true;
                    winner = "black_wins";
                }
            } else {
                if (matches[i].black_time_ms - elapsed_ms <= 0) {
                    timeout = true;
                    winner = "red_wins";
                }
            }
            
            if (timeout) {
                // Mark match as ended due to timeout
                matches[i].active = false;
                strncpy(matches[i].result, winner, sizeof(matches[i].result) - 1);
                strncpy(matches[i].end_reason, "timeout", sizeof(matches[i].end_reason) - 1);
                
                // Add to pending timeouts for broadcasting
                if (pending_timeout_count < MAX_MATCHES) {
                    timeout_info_t* ti = &pending_timeouts[pending_timeout_count++];
                    strncpy(ti->match_id, matches[i].match_id, sizeof(ti->match_id) - 1);
                    strncpy(ti->result, winner, sizeof(ti->result) - 1);
                    ti->red_user_id = matches[i].red_user_id;
                    ti->black_user_id = matches[i].black_user_id;
                }
                
                printf("[Match] Timeout detected: %s -> %s\n", matches[i].match_id, winner);
            }
        }
    }
}

// Get pending timeouts and clear them
int match_get_pending_timeouts(timeout_info_t* timeouts, int max_count) {
    int count = (pending_timeout_count < max_count) ? pending_timeout_count : max_count;
    
    for (int i = 0; i < count; i++) {
        timeouts[i] = pending_timeouts[i];
    }
    
    // Clear pending
    pending_timeout_count = 0;
    
    return count;
}
