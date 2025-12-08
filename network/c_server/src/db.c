/*
 * db.c - Database operations (SQL Server via ODBC)
 */

#include "db.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Global database handles
SQLHENV g_db_env = NULL;
SQLHDBC g_db_conn = NULL;
SQLHSTMT g_db_stmt = NULL;

// Helper function to print SQL Server errors
void db_print_error(SQLHANDLE handle, SQLSMALLINT type, const char* msg) {
    SQLCHAR sql_state[6];
    SQLCHAR error_msg[SQL_MAX_MESSAGE_LENGTH];
    SQLINTEGER native_error;
    SQLSMALLINT msg_len;

    if (msg) {
        fprintf(stderr, "[DB Error] %s\n", msg);
    }

    SQLGetDiagRec(type, handle, 1, sql_state, &native_error, error_msg,
                  sizeof(error_msg), &msg_len);

    fprintf(stderr, "[SQL Server] State: %s, Error: %d, Message: %s\n",
            sql_state, (int)native_error, error_msg);
}

// Initialize database connection
bool db_init(const char* connection_string) {
    SQLRETURN ret;

    // Allocate environment handle
    ret = SQLAllocHandle(SQL_HANDLE_ENV, SQL_NULL_HANDLE, &g_db_env);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        fprintf(stderr, "Failed to allocate environment handle\n");
        return false;
    }

    // Set ODBC version
    ret =
        SQLSetEnvAttr(g_db_env, SQL_ATTR_ODBC_VERSION, (void*)SQL_OV_ODBC3, 0);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(g_db_env, SQL_HANDLE_ENV, "Failed to set ODBC version");
        SQLFreeHandle(SQL_HANDLE_ENV, g_db_env);
        return false;
    }

    // Allocate connection handle
    ret = SQLAllocHandle(SQL_HANDLE_DBC, g_db_env, &g_db_conn);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(g_db_env, SQL_HANDLE_ENV,
                       "Failed to allocate connection handle");
        SQLFreeHandle(SQL_HANDLE_ENV, g_db_env);
        return false;
    }

    // Connect to database
    ret = SQLDriverConnect(g_db_conn, NULL, (SQLCHAR*)connection_string,
                           SQL_NTS, NULL, 0, NULL, SQL_DRIVER_NOPROMPT);

    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(g_db_conn, SQL_HANDLE_DBC,
                       "Failed to connect to database");
        SQLFreeHandle(SQL_HANDLE_DBC, g_db_conn);
        SQLFreeHandle(SQL_HANDLE_ENV, g_db_env);
        return false;
    }

    printf("[DB] Connected to SQL Server successfully\n");

    // Allocate statement handle
    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &g_db_stmt);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(g_db_conn, SQL_HANDLE_DBC,
                       "Failed to allocate statement handle");
        db_shutdown();
        return false;
    }

    return true;
}

// Shutdown database connection
void db_shutdown(void) {
    if (g_db_stmt) {
        SQLFreeHandle(SQL_HANDLE_STMT, g_db_stmt);
        g_db_stmt = NULL;
    }

    if (g_db_conn) {
        SQLDisconnect(g_db_conn);
        SQLFreeHandle(SQL_HANDLE_DBC, g_db_conn);
        g_db_conn = NULL;
    }

    if (g_db_env) {
        SQLFreeHandle(SQL_HANDLE_ENV, g_db_env);
        g_db_env = NULL;
    }

    printf("[DB] Disconnected from SQL Server\n");
}

// Execute SQL statement
bool db_execute(const char* sql) {
    SQLHSTMT stmt;
    SQLRETURN ret;

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(g_db_conn, SQL_HANDLE_DBC,
                       "Failed to allocate statement");
        return false;
    }

    ret = SQLExecDirect(stmt, (SQLCHAR*)sql, SQL_NTS);

    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(stmt, SQL_HANDLE_STMT, sql);
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return true;
}

// Create user
bool db_create_user(const char* username, const char* email,
                    const char* password_hash, int* out_user_id) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    int user_id;

    const char* sql =
        "INSERT INTO Users (username, email, password_hash, rating, wins, "
        "losses, draws) "
        "VALUES (?, ?, ?, 1200, 0, 0, 0); SELECT SCOPE_IDENTITY();";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        db_print_error(stmt, SQL_HANDLE_STMT, "Failed to prepare INSERT");
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    // Bind parameters
    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                     (SQLCHAR*)username, 0, NULL);
    SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 128, 0,
                     (SQLCHAR*)email, 0, NULL);
    SQLBindParameter(stmt, 3, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 128, 0,
                     (SQLCHAR*)password_hash, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret != SQL_SUCCESS && ret != SQL_SUCCESS_WITH_INFO) {
        db_print_error(stmt, SQL_HANDLE_STMT, "Failed to execute INSERT");
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    // Get inserted ID
    SQLMoreResults(stmt);
    ret = SQLFetch(stmt);
    if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
        SQLGetData(stmt, 1, SQL_C_SLONG, &user_id, 0, &indicator);
        if (out_user_id) {
            *out_user_id = user_id;
        }
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return true;
}

// Get user by username
bool db_get_user_by_username(const char* username, int* out_user_id,
                             char* out_password_hash, int* out_rating) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    int user_id, rating;
    char password_hash[128];

    const char* sql =
        "SELECT user_id, password_hash, rating FROM Users WHERE username = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                     (SQLCHAR*)username, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret != SQL_SUCCESS) {
        db_print_error(stmt, SQL_HANDLE_STMT, "Failed to execute SELECT");
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    ret = SQLFetch(stmt);
    if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
        SQLGetData(stmt, 1, SQL_C_SLONG, &user_id, 0, &indicator);
        SQLGetData(stmt, 2, SQL_C_CHAR, password_hash, sizeof(password_hash),
                   &indicator);
        SQLGetData(stmt, 3, SQL_C_SLONG, &rating, 0, &indicator);

        if (out_user_id) *out_user_id = user_id;
        if (out_password_hash) strcpy(out_password_hash, password_hash);
        if (out_rating) *out_rating = rating;

        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return true;
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return false;
}

// Get user by ID
bool db_get_user_by_id(int user_id, char* out_username, char* out_email,
                       int* out_rating, int* out_wins, int* out_losses,
                       int* out_draws) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    char username[64], email[128];
    int rating, wins, losses, draws;

    const char* sql =
        "SELECT username, email, rating, wins, losses, draws FROM Users WHERE "
        "user_id = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &user_id, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    ret = SQLFetch(stmt);
    if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
        SQLGetData(stmt, 1, SQL_C_CHAR, username, sizeof(username), &indicator);
        SQLGetData(stmt, 2, SQL_C_CHAR, email, sizeof(email), &indicator);
        SQLGetData(stmt, 3, SQL_C_SLONG, &rating, 0, &indicator);
        SQLGetData(stmt, 4, SQL_C_SLONG, &wins, 0, &indicator);
        SQLGetData(stmt, 5, SQL_C_SLONG, &losses, 0, &indicator);
        SQLGetData(stmt, 6, SQL_C_SLONG, &draws, 0, &indicator);

        if (out_username) strcpy(out_username, username);
        if (out_email) strcpy(out_email, email);
        if (out_rating) *out_rating = rating;
        if (out_wins) *out_wins = wins;
        if (out_losses) *out_losses = losses;
        if (out_draws) *out_draws = draws;

        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return true;
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return false;
}

// Update user rating
bool db_update_user_rating(int user_id, int new_rating) {
    SQLHSTMT stmt;
    SQLRETURN ret;

    const char* sql = "UPDATE Users SET rating = ? WHERE user_id = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &new_rating, 0, NULL);
    SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &user_id, 0, NULL);

    ret = SQLExecute(stmt);

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO);
}

// Update user stats
bool db_update_user_stats(int user_id, int wins, int losses, int draws) {
    SQLHSTMT stmt;
    SQLRETURN ret;

    const char* sql =
        "UPDATE Users SET wins = ?, losses = ?, draws = ? WHERE user_id = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &wins, 0, NULL);
    SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &losses, 0, NULL);
    SQLBindParameter(stmt, 3, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &draws, 0, NULL);
    SQLBindParameter(stmt, 4, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &user_id, 0, NULL);

    ret = SQLExecute(stmt);

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO);
}

// Save match
bool db_save_match(const char* match_id, int red_user_id, int black_user_id,
                   const char* result, const char* moves_json,
                   const char* started_at, const char* ended_at) {
    SQLHSTMT stmt;
    SQLRETURN ret;

    const char* sql =
        "INSERT INTO Matches (match_id, red_user_id, black_user_id, result, "
        "moves_json, started_at, ended_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                     (SQLCHAR*)match_id, 0, NULL);
    SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &red_user_id, 0, NULL);
    SQLBindParameter(stmt, 3, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &black_user_id, 0, NULL);
    SQLBindParameter(stmt, 4, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 16, 0,
                     (SQLCHAR*)result, 0, NULL);
    SQLBindParameter(stmt, 5, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 8000, 0,
                     (SQLCHAR*)moves_json, 0, NULL);
    SQLBindParameter(stmt, 6, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 32, 0,
                     (SQLCHAR*)started_at, 0, NULL);
    SQLBindParameter(stmt, 7, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 32, 0,
                     (SQLCHAR*)ended_at, 0, NULL);

    ret = SQLExecute(stmt);

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO);
}

// Get match by ID
bool db_get_match(const char* match_id, char* out_json, size_t json_size) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    char red_username[64], black_username[64], result[16], moves[8000],
        started[32], ended[32];

    const char* sql =
        "SELECT m.result, m.moves_json, m.started_at, m.ended_at, "
        "u1.username as red_name, u2.username as black_name "
        "FROM Matches m "
        "JOIN Users u1 ON m.red_user_id = u1.user_id "
        "JOIN Users u2 ON m.black_user_id = u2.user_id "
        "WHERE m.match_id = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                     (SQLCHAR*)match_id, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    ret = SQLFetch(stmt);
    if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
        SQLGetData(stmt, 1, SQL_C_CHAR, result, sizeof(result), &indicator);
        SQLGetData(stmt, 2, SQL_C_CHAR, moves, sizeof(moves), &indicator);
        SQLGetData(stmt, 3, SQL_C_CHAR, started, sizeof(started), &indicator);
        SQLGetData(stmt, 4, SQL_C_CHAR, ended, sizeof(ended), &indicator);
        SQLGetData(stmt, 5, SQL_C_CHAR, red_username, sizeof(red_username),
                   &indicator);
        SQLGetData(stmt, 6, SQL_C_CHAR, black_username, sizeof(black_username),
                   &indicator);

        snprintf(
            out_json, json_size,
            "{\"match_id\":\"%s\",\"red_user\":\"%s\",\"black_user\":\"%s\","
            "\"result\":\"%s\",\"moves\":%s,\"started_at\":\"%s\",\"ended_at\":"
            "\"%s\"}",
            match_id, red_username, black_username, result, moves, started,
            ended);

        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return true;
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return false;
}

// Get leaderboard
bool db_get_leaderboard(int limit, int offset, char* out_json,
                        size_t json_size) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    char username[64];
    int rating, wins, losses, draws;
    char buffer[512];

    const char* sql =
        "SELECT username, rating, wins, losses, draws FROM Users "
        "ORDER BY rating DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &offset, 0, NULL);
    SQLBindParameter(stmt, 2, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &limit, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    strcpy(out_json, "[");
    bool first = true;

    while (SQLFetch(stmt) == SQL_SUCCESS) {
        SQLGetData(stmt, 1, SQL_C_CHAR, username, sizeof(username), &indicator);
        SQLGetData(stmt, 2, SQL_C_SLONG, &rating, 0, &indicator);
        SQLGetData(stmt, 3, SQL_C_SLONG, &wins, 0, &indicator);
        SQLGetData(stmt, 4, SQL_C_SLONG, &losses, 0, &indicator);
        SQLGetData(stmt, 5, SQL_C_SLONG, &draws, 0, &indicator);

        snprintf(buffer, sizeof(buffer),
                 "%s{\"username\":\"%s\",\"rating\":%d,\"wins\":%d,\"losses\":%"
                 "d,\"draws\":%d}",
                 first ? "" : ",", username, rating, wins, losses, draws);

        if (strlen(out_json) + strlen(buffer) + 2 < json_size) {
            strcat(out_json, buffer);
            first = false;
        }
    }

    strcat(out_json, "]");

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return true;
}

// Check if username exists
bool db_check_username_exists(const char* username) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    int count = 0;
    SQLLEN indicator;

    const char* sql = "SELECT COUNT(*) FROM Users WHERE username = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 64, 0,
                     (SQLCHAR*)username, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret == SQL_SUCCESS) {
        SQLFetch(stmt);
        SQLGetData(stmt, 1, SQL_C_SLONG, &count, 0, &indicator);
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return count > 0;
}

// Check if email exists
bool db_check_email_exists(const char* email) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    int count = 0;
    SQLLEN indicator;

    const char* sql = "SELECT COUNT(*) FROM Users WHERE email = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_CHAR, SQL_VARCHAR, 128, 0,
                     (SQLCHAR*)email, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret == SQL_SUCCESS) {
        SQLFetch(stmt);
        SQLGetData(stmt, 1, SQL_C_SLONG, &count, 0, &indicator);
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return count > 0;
}

// Get username by user_id
bool db_get_username(int user_id, char* out_username, size_t username_size) {
    SQLHSTMT stmt;
    SQLRETURN ret;
    SQLLEN indicator;
    char username[64] = {0};

    const char* sql = "SELECT username FROM Users WHERE user_id = ?";

    ret = SQLAllocHandle(SQL_HANDLE_STMT, g_db_conn, &stmt);
    if (ret != SQL_SUCCESS) {
        return false;
    }

    ret = SQLPrepare(stmt, (SQLCHAR*)sql, SQL_NTS);
    if (ret != SQL_SUCCESS) {
        SQLFreeHandle(SQL_HANDLE_STMT, stmt);
        return false;
    }

    SQLBindParameter(stmt, 1, SQL_PARAM_INPUT, SQL_C_SLONG, SQL_INTEGER, 0, 0,
                     &user_id, 0, NULL);

    ret = SQLExecute(stmt);
    if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
        ret = SQLFetch(stmt);
        if (ret == SQL_SUCCESS || ret == SQL_SUCCESS_WITH_INFO) {
            SQLGetData(stmt, 1, SQL_C_CHAR, username, sizeof(username),
                       &indicator);
            strncpy(out_username, username, username_size - 1);
            out_username[username_size - 1] = '\0';
            SQLFreeHandle(SQL_HANDLE_STMT, stmt);
            return true;
        }
    }

    SQLFreeHandle(SQL_HANDLE_STMT, stmt);
    return false;
}
