#ifndef MATCH_H
#define MATCH_H

#include <stdbool.h>
#include <time.h>

#define MAX_MATCHES 500
#define MAX_MOVES_PER_MATCH 300

typedef struct {
    int move_id;
    char from_row;
    char from_col;
    char to_row;
    char to_col;
    char piece[16];
    char capture[16];
    char notation[32];
    time_t timestamp;
    int red_time_ms;
    int black_time_ms;
} move_t;

typedef struct {
    char match_id[32];
    int red_user_id;
    int black_user_id;
    char current_turn[6];  // "red" or "black"
    int move_count;
    move_t moves[MAX_MOVES_PER_MATCH];
    bool rated;
    int red_time_ms;
    int black_time_ms;
    time_t started_at;
    time_t last_move_at;
    bool active;
    char result[16];      // "red_wins", "black_wins", "draw", "ongoing"
    char end_reason[32];  // "checkmate", "resign", "timeout", etc.
} match_t;

// Match management
bool match_init(void);
void match_shutdown(void);

char* match_create(int red_user_id, int black_user_id, bool rated, int time_ms);
match_t* match_get(const char* match_id);
match_t* match_find_by_id(const char* match_id);
match_t* match_find_by_user(int user_id);
bool match_validate_move(const char* match_id, int user_id, int from_row,
                         int from_col, int to_row, int to_col);
bool match_add_move(const char* match_id, const move_t* move);
bool match_end(const char* match_id, const char* result, const char* reason);
char* match_get_json(const char* match_id);
char* match_get_moves_json(const match_t* match);
int match_get_opponent_id(const match_t* match, int user_id);
bool match_is_checkmate(match_t* match);

// Move validation (basic sanity checks)
bool is_valid_position(int row, int col);
bool is_correct_turn(match_t* match, int user_id);

#endif  // MATCH_H
