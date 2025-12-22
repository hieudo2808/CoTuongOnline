#ifndef DB_H
#define DB_H

#include <stdbool.h>
#include <stddef.h>

#ifdef _WIN32
#include <sql.h>
#include <sqlext.h>
#include <windows.h>
#else
// Linux: Use unixODBC
#include <sql.h>
#include <sqlext.h>
#endif

// Database connection handles
extern SQLHENV g_db_env;
extern SQLHDBC g_db_conn;
extern SQLHSTMT g_db_stmt;

// Initialize database with SQL Server
// Connection string example: "Driver={ODBC Driver 17 for SQL
// Server};Server=localhost;Database=XiangqiDB;UID=sa;PWD=YourPassword123;"
bool db_init(const char* connection_string);
void db_shutdown(void);

// User operations
bool db_create_user(const char* username, const char* email,
                    const char* password_hash, int* out_user_id);
bool db_get_user_by_username(const char* username, int* out_user_id,
                             char* out_password_hash, int* out_rating);
bool db_get_user_by_id(int user_id, char* out_username, char* out_email,
                       int* out_rating, int* out_wins, int* out_losses,
                       int* out_draws);
bool db_update_user_rating(int user_id, int new_rating);
bool db_update_user_stats(int user_id, int wins, int losses, int draws);

// Match operations
bool db_save_match(const char* match_id, int red_user_id, int black_user_id,
                   const char* result, const char* moves_json,
                   const char* started_at, const char* ended_at);
bool db_get_match(const char* match_id, char* out_json, size_t json_size);
bool db_get_match_history(int user_id, int limit, int offset, char* out_json, size_t json_size);

// Profile - get detailed user stats
bool db_get_user_profile(int user_id, char* out_json, size_t json_size);

// Leaderboard
bool db_get_leaderboard(int limit, int offset, char* out_json,
                        size_t json_size);

// Utility
bool db_execute(const char* sql);
bool db_check_username_exists(const char* username);
bool db_check_email_exists(const char* email);
bool db_get_username(int user_id, char* out_username, size_t username_size);

// Helper to print SQL Server errors
void db_print_error(SQLHANDLE handle, SQLSMALLINT type, const char* msg);

#endif  // DB_H
