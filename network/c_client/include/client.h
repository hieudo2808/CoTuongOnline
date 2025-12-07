#ifndef CLIENT_H
#define CLIENT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define BUFFER_SIZE 16384

// Client state
typedef struct {
    int socket_fd;
    char recv_buffer[BUFFER_SIZE];
    size_t recv_len;
    char send_buffer[BUFFER_SIZE];
    size_t send_len;
    bool connected;
    int seq_counter;
    char session_token[65];
} client_t;

// Callback for received messages
typedef void (*message_callback_t)(const char* json);

// Client API for JS integration
int client_connect(const char* host, int port);
int client_disconnect(void);
int client_send_json(const char* json);
void client_set_message_callback(message_callback_t callback);
int client_process_messages(void);
bool client_is_connected(void);

// Internal functions
int client_send_raw(const char* data, size_t len);
int client_recv_and_process(void);

#endif  // CLIENT_H
