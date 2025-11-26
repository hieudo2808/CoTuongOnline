/**
 * networkBridge.js - Bridge between HTML/JS UI and C Client
 *
 * This module spawns the C client as a subprocess and communicates
 * via stdin/stdout with JSON messages.
 */

import { spawn } from "child_process";
import { EventEmitter } from "events";

export class NetworkBridge extends EventEmitter {
    constructor(clientBinaryPath) {
        super();
        this.clientBinaryPath =
            clientBinaryPath || "../network/c_client/bin/client";
        this.process = null;
        this.connected = false;
        this.seqCounter = 1;
        this.sessionToken = null;
        this.buffer = "";
    }

    /**
     * Connect to server
     * @param {string} host - Server hostname/IP
     * @param {number} port - Server port
     */
    connect(host, port) {
        return new Promise((resolve, reject) => {
            // Spawn C client process
            this.process = spawn(this.clientBinaryPath, [
                host,
                port.toString(),
            ]);

            // Handle stdout (messages from server via C client)
            this.process.stdout.on("data", (data) => {
                this.handleData(data.toString());
            });

            // Handle stderr (debugging)
            this.process.stderr.on("data", (data) => {
                console.error("[C Client]", data.toString());
            });

            // Handle process exit
            this.process.on("exit", (code) => {
                console.log(`C client exited with code ${code}`);
                this.connected = false;
                this.emit("disconnected");
            });

            // Wait for connection confirmation
            const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
            }, 5000);

            this.once("connected", () => {
                clearTimeout(timeout);
                this.connected = true;
                resolve();
            });

            // Trigger connected after short delay (assumes C client connects immediately)
            setTimeout(() => {
                this.emit("connected");
            }, 500);
        });
    }

    /**
     * Handle incoming data from C client
     */
    handleData(data) {
        this.buffer += data;

        // Process complete messages (newline-delimited)
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    this.handleMessage(message);
                } catch (e) {
                    console.error("Failed to parse message:", line, e);
                }
            }
        }
    }

    /**
     * Handle parsed message
     */
    handleMessage(message) {
        console.log("Received:", message.type);

        // Store session token
        if (message.token) {
            this.sessionToken = message.token;
        }

        // Emit event for message type
        this.emit("message", message);
        this.emit(message.type, message);
    }

    /**
     * Send message to server
     */
    send(type, payload) {
        if (!this.connected) {
            throw new Error("Not connected");
        }

        const message = {
            type,
            seq: this.seqCounter++,
            token: this.sessionToken,
            payload,
        };

        const json = JSON.stringify(message) + "\n";
        this.process.stdin.write(json);

        return message.seq;
    }

    /**
     * Register account
     */
    async register(username, email, password) {
        // Hash password (SHA-256)
        const passwordHash = await this.hashPassword(password);

        const seq = this.send("register", {
            username,
            email,
            password: passwordHash,
        });

        return this.waitForResponse("register_response", seq);
    }

    /**
     * Login
     */
    async login(username, password) {
        const passwordHash = await this.hashPassword(password);

        const seq = this.send("login", {
            username,
            password: passwordHash,
        });

        return this.waitForResponse("login_response", seq);
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
    findMatch(matchType = "random", ratingTolerance = 100) {
        return this.send("find_match", {
            match_type: matchType,
            rating_tolerance: ratingTolerance,
        });
    }

    /**
     * Send move
     */
    sendMove(matchId, moveData) {
        return this.send("move", {
            match_id: matchId,
            ...moveData,
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
     * Get leaderboard
     */
    getLeaderboard(limit = 10, offset = 0) {
        return this.send("leaderboard", { limit, offset });
    }

    /**
     * Wait for specific response
     */
    waitForResponse(type, seq) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${type}`));
            }, 10000);

            const handler = (message) => {
                if (message.type === type && message.seq === seq) {
                    clearTimeout(timeout);
                    this.off(type, handler);
                    resolve(message);
                }
            };

            this.on(type, handler);
        });
    }

    /**
     * Hash password using SHA-256
     */
    async hashPassword(password) {
        // In browser, use Web Crypto API
        if (typeof window !== "undefined" && window.crypto) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await window.crypto.subtle.digest(
                "SHA-256",
                data
            );
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        }

        // In Node.js, use crypto module
        const crypto = require("crypto");
        return crypto.createHash("sha256").update(password).digest("hex");
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.connected = false;
        this.emit("disconnected");
    }
}

export default NetworkBridge;
