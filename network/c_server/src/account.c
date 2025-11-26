/*
 * account.c - User account operations
 */

#include "account.h"

#include <ctype.h>
#include <regex.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "db.h"

// Validate username (alphanumeric, 3-20 chars)
bool validate_username(const char* username) {
    if (!username) return false;

    size_t len = strlen(username);
    if (len < 3 || len > 20) return false;

    for (size_t i = 0; i < len; i++) {
        if (!isalnum(username[i]) && username[i] != '_') {
            return false;
        }
    }

    return true;
}

// Validate email
bool validate_email(const char* email) {
    if (!email) return false;

    // Simple email validation
    const char* at = strchr(email, '@');
    if (!at || at == email) return false;

    const char* dot = strchr(at, '.');
    if (!dot || dot == at + 1) return false;

    return true;
}

// Check if username exists
bool username_exists(const char* username) {
    return db_check_username_exists(username);
}

// Check if email exists
bool email_exists(const char* email) { return db_check_email_exists(email); }

// Register new account
bool account_register(const char* username, const char* email,
                      const char* password_hash, int* out_user_id) {
    // Validate inputs
    if (!validate_username(username)) {
        fprintf(stderr, "Invalid username: %s\n", username);
        return false;
    }

    if (!validate_email(email)) {
        fprintf(stderr, "Invalid email: %s\n", email);
        return false;
    }

    // Check duplicates
    if (username_exists(username)) {
        fprintf(stderr, "Username already exists: %s\n", username);
        return false;
    }

    if (email_exists(email)) {
        fprintf(stderr, "Email already exists: %s\n", email);
        return false;
    }

    // Create user in database
    return db_create_user(username, email, password_hash, out_user_id);
}

// Login
bool account_login(const char* username, const char* password_hash,
                   user_t* out_user) {
    int user_id;
    char stored_hash[65];
    int rating;

    if (!db_get_user_by_username(username, &user_id, stored_hash, &rating)) {
        return false;
    }

    // Verify password
    if (strcmp(stored_hash, password_hash) != 0) {
        return false;
    }

    // Get full user details
    char email[128];

    if (!db_get_user_by_id(user_id, out_user->username, email,
                           &out_user->rating, &out_user->wins,
                           &out_user->losses, &out_user->draws)) {
        return false;
    }

    out_user->user_id = user_id;
    strcpy(out_user->email, email);
    strcpy(out_user->password_hash, stored_hash);

    return true;
}

// Get user by ID
bool account_get_by_id(int user_id, user_t* out_user) {
    char email[128];

    if (!db_get_user_by_id(user_id, out_user->username, email,
                           &out_user->rating, &out_user->wins,
                           &out_user->losses, &out_user->draws)) {
        return false;
    }

    out_user->user_id = user_id;
    strcpy(out_user->email, email);

    return true;
}

// Update rating
bool account_update_rating(int user_id, int new_rating) {
    return db_update_user_rating(user_id, new_rating);
}

// Update stats
bool account_update_stats(int user_id, int wins, int losses, int draws) {
    return db_update_user_stats(user_id, wins, losses, draws);
}
