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
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log("[WebSocket] Disconnected");
                    this.connected = false;
                    this.emit("disconnected");
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
            const message = JSON.parse(data);
            console.log("[WebSocket] Received:", message.type);

            // Store session token
            if (message.token) {
                this.sessionToken = message.token;
            }

            // Resolve pending request if exists
            if (message.seq && this.pendingRequests.has(message.seq)) {
                const { resolve } = this.pendingRequests.get(message.seq);
                this.pendingRequests.delete(message.seq);
                resolve(message);
            }

            // Emit event
            this.emit("message", message);
            this.emit(message.type, message);
        } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
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
            token: this.sessionToken || "",
            payload,
        };

        const json = JSON.stringify(message);
        this.ws.send(json);

        return message.seq;
    }

    /**
     * Send and wait for response
     */
    sendAndWait(type, payload = {}, responseType = null, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const seq = this.send(type, payload);

            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(seq);
                reject(
                    new Error(
                        `Timeout waiting for ${responseType || type}_response`
                    )
                );
            }, timeout);

            this.pendingRequests.set(seq, {
                resolve: (message) => {
                    clearTimeout(timeoutId);
                    // Check if response indicates failure
                    if (message.success === false || message.type === 'error') {
                        reject(
                            new Error(
                                message.message || "Request failed"
                            )
                        );
                    } else {
                        resolve(message);
                    }
                },
                reject,
            });
        });
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
        return this.send("set_ready", { ready });
    }

    /**
     * Find match
     */
    async findMatch(matchType = "random", ratingTolerance = 100) {
        return this.send("find_match", {
            match_type: matchType,
            rating_tolerance: ratingTolerance,
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
