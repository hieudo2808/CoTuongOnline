/**
 * WebSocket Network Bridge for Browser
 * Replaces the Node.js-based networkBridge with WebSocket
 */

class NetworkBridge {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.seqCounter = 1;
        this.sessionToken = null;
        this.eventListeners = new Map();
        this.pendingRequests = new Map();
        // Match search state: when server replies "No opponent found" we wait
        // for a subsequent `match_found` event before emitting an error to UI.
        this._matchSearchWaiting = false;
        this._matchSearchTimer = null;
        this._matchSearchTimeoutMs = 60000; // 60 seconds
    }

    /**
     * Connect to WebSocket server
     * @param {string} host - Server hostname/IP
     * @param {number} port - Server port
     */
    connect(host, port) {
        return new Promise((resolve, reject) => {
            const wsUrl = `ws://${host}:${port}`;

            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log("[WebSocket] Connected to", wsUrl);
                    this.connected = true;
                    this.emit("connected");
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error("[WebSocket] Error:", error);
                    this.emit("error", error);
                    // Reject any pending requests immediately so callers don't wait for timeout
                    try {
                        this._rejectAllPending(new Error('WebSocket error'));
                    } catch (e) {}
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log("[WebSocket] Disconnected");
                    this.connected = false;
                    this.emit("disconnected");
                    // Reject outstanding requests when connection closes
                    try { this._rejectAllPending(new Error('WebSocket closed')); } catch (e) {}
                };

                // Connection timeout
                setTimeout(() => {
                    if (!this.connected) {
                        this.ws.close();
                        reject(new Error("Connection timeout"));
                    }
                }, 5000);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            // Log raw incoming data for debugging
            console.log('[WebSocket] Raw message:', data);

            let message;
            try {
                message = JSON.parse(data);
            } catch (parseErr) {
                console.error('[WebSocket] JSON.parse failed:', parseErr.message);
                console.error('[WebSocket] Raw data:', data);
                // Try to extract any useful info from the raw data
                return;
            }

            // If parsed value is not an object, wrap it
            if (!message || typeof message !== 'object' || Array.isArray(message)) {
                console.warn('[WebSocket] Non-object message received:', message);
                message = { type: 'unknown', raw: message };
            }

            // Normalize payload: server may send payload as object or stringified JSON
            if (message.payload && typeof message.payload === 'string') {
                try {
                    message.payload = JSON.parse(message.payload);
                } catch (e) {
                    // leave as string
                }
            }

            // Normalize top-level message text for easier handling
            if (!message.message) {
                if (message.payload && typeof message.payload === 'object') {
                    if (message.payload.message) message.message = message.payload.message;
                    else if (message.payload.error_code) message.message = message.payload.error_code;
                }
            }

            // Special-case: server may immediately reply with an error saying
            // "No opponent found" when matchmaking. Treat that as an
            // acknowledgement and wait for a later `match_found` event. Start
            // a timer and only emit an error if no match_found arrives.
            const isNoOpponentMsgEarly =
                message.type === 'error' && message.message && /no opponent/i.test(message.message);

            if (isNoOpponentMsgEarly) {
                if (this._matchSearchTimer) clearTimeout(this._matchSearchTimer);
                this._matchSearchWaiting = true;
                this._matchSearchTimer = setTimeout(() => {
                    this._matchSearchWaiting = false;
                    this._matchSearchTimer = null;
                    try {
                        this.emit('match_search_timeout', { message: message.message });
                    } catch (e) {
                        console.error('[WebSocket] Error emitting match_search_timeout:', e);
                    }
                    try {
                        this.emit('error', new Error(message.message || 'No opponent found'));
                    } catch (e) {
                        console.error('[WebSocket] Error emitting error event:', e);
                    }
                }, this._matchSearchTimeoutMs);

                // Do not log or emit this error immediately; wait for match_found
                return;
            }

            // Log full message for easier debugging (type, message text, payload)
            if (message.type === 'error' || message.type === 'response') {
                console.log("[WebSocket] Received:", message.type, "seq:", message.seq, "message:", message.message || null);
            } else {
                console.log("[WebSocket] Received:", message.type, "seq:", message.seq);
            }

            

            // Store session token (server may put token at top-level or inside payload)
            if (message.token) {
                this.sessionToken = message.token;
                console.log('[WebSocket] Token updated');
            } else if (message.payload && message.payload.token) {
                this.sessionToken = message.payload.token;
                console.log('[WebSocket] Token updated from payload');
            }

            // Resolve pending request if exists (most important: don't emit before resolving)
            if (message.seq && this.pendingRequests.has(message.seq)) {
                const pendingHandler = this.pendingRequests.get(message.seq);
                try {
                    console.log('[WebSocket] Resolving pending request seq=' + message.seq);
                    pendingHandler.resolve(message);
                } catch (e) {
                    console.error('[WebSocket] Error in resolve callback:', e);
                }
                // Don't emit after resolving pending request (it's a response to a send/wait)
                return;
            }

            // Compatibility: some servers send a `response` with message "Match found"
            // as the immediate reply to the requester while sending a separate
            // `match_found` to the queued opponent. Normalize this by treating
            // a response whose message includes "match found" as a
            // `match_found` event as well so both clients handle the match the
            // same way.
            if (message.type === 'response' && message.message && /match found/i.test(message.message)) {
                try {
                    const mf = {
                        type: 'match_found',
                        seq: message.seq,
                        payload: message.payload || null,
                        message: message.message,
                    };
                    // Emit normalized match_found for client code that listens for it
                    console.log('[WebSocket] Normalizing response -> match_found for seq=' + message.seq);
                    this.emit('message', mf);
                    this.emit('match_found', mf);
                } catch (e) {
                    console.error('[WebSocket] Error emitting normalized match_found:', e);
                }
                // Continue to also emit the original message below (so existing handlers still receive it)
            }

            // Emit event for unsolicited messages (like match_found, draw_offer, etc.)
            try {
                // If a match_found arrives while we were waiting, cancel the
                // match search timer and clear waiting state.
                if (message.type === 'match_found' && this._matchSearchWaiting) {
                    if (this._matchSearchTimer) {
                        clearTimeout(this._matchSearchTimer);
                        this._matchSearchTimer = null;
                    }
                    this._matchSearchWaiting = false;
                }

                this.emit("message", message);
                if (message.type) {
                    console.log('[WebSocket] Emitting event:', message.type);
                    this.emit(message.type, message);
                }
            } catch (e) {
                console.error('[WebSocket] Error emitting event:', e);
            }
        } catch (error) {
            console.error("[WebSocket] Unexpected error in handleMessage:", error);
        }
    }

    /**
     * Send message to server
     */
    send(type, payload = {}) {
        if (!this.connected) {
            throw new Error("WebSocket not connected");
        }

        const message = {
            type,
            seq: this.seqCounter++,
            payload,
        };

        // Only include token when it's set (avoid sending empty string)
        if (this.sessionToken) {
            message.token = this.sessionToken;
        }

        const json = JSON.stringify(message);
        // Log outgoing message for debugging
        try {
            console.log('[WebSocket] Sending:', json);
        } catch (e) {}

        this.ws.send(json);

        return message.seq;
    }

    /**
     * Send and wait for response
     */
    sendAndWait(type, payload = {}, responseType = null, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not connected'));
            }

            // Reserve a sequence number and register pending handler BEFORE sending
            const seq = this.seqCounter++;

            const timeoutId = setTimeout(() => {
                // Cleanup
                this.pendingRequests.delete(seq);
                const timeoutErr = new Error(
                    `Timeout waiting for ${responseType || type}_response after ${timeout}ms`
                );
                console.error('[WebSocket] ' + timeoutErr.message);
                reject(timeoutErr);
            }, timeout);

            const pendingHandler = {
                resolve: (message) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(seq);

                    // Determine failure conditions (server uses multiple formats)
                    const messagePayload = message.payload;
                    const isErrorType = message.type === 'error';
                    const isExplicitFailure = message.success === false;
                    const payloadHasError = messagePayload && typeof messagePayload === 'object' && (messagePayload.error_code || messagePayload.message);

                    if (isErrorType || isExplicitFailure || payloadHasError) {
                        const errMsg = message.message || (messagePayload && messagePayload.message) || (messagePayload && messagePayload.error_code) || 'Request failed';
                        console.error(`[WebSocket] Request ${type} failed:`, errMsg);
                        reject(new Error(errMsg));
                    } else {
                        console.log(`[WebSocket] Request ${type} succeeded`);
                        resolve(message);
                    }
                },
                reject: (err) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(seq);
                    reject(err);
                },
            };

            this.pendingRequests.set(seq, pendingHandler);

            // Build and send the message now that pending is registered
            const message = {
                type,
                seq,
                payload,
            };
            if (this.sessionToken) message.token = this.sessionToken;

            const json = JSON.stringify(message);
            try {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    try { console.log('[WebSocket] Sending (sendAndWait):', json); } catch (e) {}
                    this.ws.send(json);
                } else {
                    // Socket closed after registration
                    this.pendingRequests.delete(seq);
                    clearTimeout(timeoutId);
                    return reject(new Error('WebSocket closed before send'));
                }
            } catch (sendErr) {
                this.pendingRequests.delete(seq);
                clearTimeout(timeoutId);
                return reject(sendErr);
            }
        });
    }

    // Reject all pending requests with provided error
    _rejectAllPending(err) {
        try {
            for (const [seq, handler] of this.pendingRequests.entries()) {
                try { handler.reject(err); } catch (e) {}
            }
            this.pendingRequests.clear();
        } catch (e) {}
    }

    /**
     * Event emitter
     */
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }

    once(event, listener) {
        const onceWrapper = (...args) => {
            listener(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }

    off(event, listener) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    emit(event, ...args) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event);
        listeners.forEach((listener) => {
            try {
                listener(...args);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }

    /**
     * Hash password using DJB2 algorithm (same as C server)
     */
    hashPassword(password) {
        let hash = 5381;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) + hash) + password.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        // Convert to hex string (64 chars like C server)
        const hashStr = (hash >>> 0).toString(16).padStart(8, '0');
        return hashStr.padEnd(64, '0');
    }

    /**
     * Register account
     */
    register(username, email, password) {
        const passwordHash = this.hashPassword(password);
        return this.sendAndWait(
            "register",
            {
                username,
                email,
                password: passwordHash,
            },
            "register"
        );
    }

    /**
     * Login
     */
    login(username, password) {
        const passwordHash = this.hashPassword(password);
        return this.sendAndWait(
            "login",
            {
                username,
                password: passwordHash,
            },
            "login"
        );
    }

    /**
     * Logout
     */
    async logout() {
        return this.send("logout", {});
    }

    /**
     * Set ready status
     */
    setReady(ready = true) {
        return this.sendAndWait("set_ready", { ready }, "set_ready", 5000);
    }

    /**
     * Find match
     */
    async findMatch(matchType = "random", ratingTolerance = 100, timeout = 60000) {
        // Send a matchmaking request and wait for a later unsolicited `match_found` event.
        // Some servers immediately reply "No opponent found" but will later emit
        // a `match_found` event when an opponent becomes available. Treat the
        // immediate response as an acknowledgement and wait for the event instead
        // of rejecting the promise.
        try {
            this.send("find_match", {
                mode: matchType === 'rated' ? 'rated' : 'random',
                rating_tolerance: ratingTolerance,
            });
        } catch (err) {
            return Promise.reject(err);
        }

        return new Promise((resolve, reject) => {
            const onMatchFound = (msg) => {
                clearTimeout(timerId);
                this.off('match_found', onMatchFound);
                resolve(msg);
            };

            // Timeout if no opponent found within given time
            const timerId = setTimeout(() => {
                this.off('match_found', onMatchFound);
                reject(new Error('Timeout waiting for opponent'));
            }, timeout);

            this.on('match_found', onMatchFound);
        });
    }

    /**
     * Send move
     */
    sendMove(matchId, fromRow, fromCol, toRow, toCol) {
        return this.send("move", {
            match_id: matchId,
            from_row: fromRow,
            from_col: fromCol,
            to_row: toRow,
            to_col: toCol,
        });
    }

    /**
     * Resign
     */
    resign(matchId) {
        return this.send("resign", { match_id: matchId });
    }

    /**
     * Offer draw
     */
    offerDraw(matchId) {
        return this.send("draw_offer", { match_id: matchId });
    }

    /**
     * Respond to draw offer
     */
    respondDraw(matchId, accept) {
        return this.send("draw_response", {
            match_id: matchId,
            accept,
        });
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard(limit = 10, offset = 0) {
        const response = await this.sendAndWait(
            "leaderboard",
            {
                limit,
                offset,
            },
            "leaderboard"
        );
        return response.payload.leaderboard || [];
    }

    /**
     * Get match info
     */
    async getMatch(matchId) {
        return this.sendAndWait(
            "get_match",
            {
                match_id: matchId,
            },
            "get_match"
        );
    }

    /**
     * Send challenge
     */
    sendChallenge(opponentId, timeLimit = 600) {
        return this.send("challenge", {
            opponent_id: opponentId,
            time_limit: timeLimit,
        });
    }

    /**
     * Respond to challenge
     */
    respondChallenge(challengeId, accept) {
        return this.send("challenge_response", {
            challenge_id: challengeId,
            accept,
        });
    }

    /**
     * Send heartbeat
     */
    sendHeartbeat() {
        return this.send("heartbeat", {});
    }

    /**
     * Send chat message
     */
    sendChatMessage(matchId, message) {
        return this.send("chat_message", {
            token: this.sessionToken,
            match_id: matchId,
            message,
        });
    }

    /**
     * Create a room
     */
    createRoom(roomName = "", password = "", rated = false) {
        return this.sendAndWait("create_room", {
            room_name: roomName,
            password: password,
            rated: rated
        }, "create_room");
    }

    /**
     * Join a room
     */
    joinRoom(roomCode, password = "") {
        return this.sendAndWait("join_room", {
            room_code: roomCode,
            password: password
        }, "join_room");
    }

    /**
     * Leave a room
     */
    leaveRoom(roomCode) {
        return this.sendAndWait("leave_room", {
            room_code: roomCode
        }, "leave_room");
    }

    /**
     * Get rooms list
     */
    getRooms() {
        return this.sendAndWait("get_rooms", {}, "get_rooms");
    }

    /**
     * Start game in room (host only)
     */
    startRoomGame(roomCode) {
        return this.send("start_room_game", {
            room_code: roomCode
        });
    }

    /**
     * Request rematch
     */
    requestRematch(matchId) {
        return this.sendAndWait("rematch_request", {
            match_id: matchId
        }, "rematch_request");
    }

    /**
     * Respond to rematch request
     */
    respondRematch(matchId, accept) {
        return this.send("rematch_response", {
            match_id: matchId,
            accept: accept
        });
    }

    /**
     * Get match history
     */
    getMatchHistory(limit = 20, offset = 0) {
        return this.sendAndWait("match_history", {
            limit: limit,
            offset: offset
        }, "match_history");
    }

    /**
     * Get match details (for replay)
     */
    getMatchDetails(matchId) {
        return this.sendAndWait("get_match", {
            match_id: matchId
        }, "get_match");
    }

    // =========================
    // Spectator Functions
    // =========================

    /**
     * Get list of live matches for spectating
     */
    getLiveMatches() {
        return this.sendAndWait("get_live_matches", {}, "get_live_matches");
    }

    /**
     * Join a match as spectator
     * @param {string} matchId - The match ID to spectate
     */
    joinSpectate(matchId) {
        return this.sendAndWait("join_spectate", {
            match_id: matchId
        }, "join_spectate");
    }

    /**
     * Leave spectating a match
     * @param {string} matchId - The match ID to stop spectating
     */
    leaveSpectate(matchId) {
        return this.sendAndWait("leave_spectate", {
            match_id: matchId
        }, "leave_spectate");
    }

    // =========================
    // Profile Functions
    // =========================

    /**
     * Get user profile (own or another user's)
     * @param {number} userId - Optional user ID (defaults to own profile)
     */
    getProfile(userId = null) {
        const payload = userId ? { user_id: userId } : {};
        return this.sendAndWait("get_profile", payload, "get_profile");
    }

    // =========================
    // Timer Functions
    // =========================

    /**
     * Get current timer state from server
     * @param {string} matchId - Optional match ID
     */
    getTimer(matchId = null) {
        const payload = matchId ? { match_id: matchId } : {};
        return this.sendAndWait("get_timer", payload, "get_timer");
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.sessionToken = null;
        this.pendingRequests.clear();
    }
}

export default NetworkBridge;
