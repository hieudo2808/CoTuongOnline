/*
 * session.c - Session management
 * Hash table for in-memory session storage
 */

#include "session.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_SESSIONS 1000

static session_t* sessions[MAX_SESSIONS];
static int session_count = 0;

// Generate random token
static void generate_token(char* token) {
    const char charset[] = "0123456789abcdef";
    for (int i = 0; i < 64; i++) {
        token[i] = charset[rand() % 16];
    }
    token[64] = '\0';
}

// Initialize session manager
bool session_init(void) {
    memset(sessions, 0, sizeof(sessions));
    srand(time(NULL));
    return true;
}

// Create new session
char* session_create(int user_id) {
    if (session_count >= MAX_SESSIONS) {
        session_cleanup_expired();
        if (session_count >= MAX_SESSIONS) {
            return NULL;
        }
    }

    session_t* session = calloc(1, sizeof(session_t));
    if (!session) return NULL;

    generate_token(session->token);
    session->user_id = user_id;
    session->created_at = time(NULL);
    session->last_activity = time(NULL);

    // Add to sessions array
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i] == NULL) {
            sessions[i] = session;
            session_count++;
            break;
        }
    }

    char* token_copy = strdup(session->token);
    return token_copy;
}

// Validate session
bool session_validate(const char* token, int* out_user_id) {
    if (!token) return false;

    time_t now = time(NULL);

    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i] && strcmp(sessions[i]->token, token) == 0) {
            // Check timeout
            if (now - sessions[i]->last_activity > SESSION_TIMEOUT) {
                session_destroy(token);
                return false;
            }

            if (out_user_id) {
                *out_user_id = sessions[i]->user_id;
            }
            return true;
        }
    }

    return false;
}

// Update activity
void session_update_activity(const char* token) {
    if (!token) return;

    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i] && strcmp(sessions[i]->token, token) == 0) {
            sessions[i]->last_activity = time(NULL);
            return;
        }
    }
}

// Destroy session
void session_destroy(const char* token) {
    if (!token) return;

    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i] && strcmp(sessions[i]->token, token) == 0) {
            free(sessions[i]);
            sessions[i] = NULL;
            session_count--;
            return;
        }
    }
}

// Cleanup expired sessions
void session_cleanup_expired(void) {
    time_t now = time(NULL);
    int cleaned = 0;

    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i]) {
            if (now - sessions[i]->last_activity > SESSION_TIMEOUT) {
                free(sessions[i]);
                sessions[i] = NULL;
                session_count--;
                cleaned++;
            }
        }
    }

    if (cleaned > 0) {
        printf("Cleaned %d expired sessions\n", cleaned);
    }
}

// Shutdown session manager
void session_shutdown(void) {
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (sessions[i]) {
            free(sessions[i]);
            sessions[i] = NULL;
        }
    }
    session_count = 0;
}
