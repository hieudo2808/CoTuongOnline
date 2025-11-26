/**
 * Environment configuration
 */

const ENV = {
    development: {
        SERVER_HOST: "localhost",
        SERVER_PORT: 8080,  // Changed to match C server
        WS_PROTOCOL: "ws",
        ENABLE_LOGGING: true,
        ENABLE_DEBUG: true,
        API_TIMEOUT: 10000,
        RECONNECT_INTERVAL: 3000,
        MAX_RECONNECT_ATTEMPTS: 5,
        HEARTBEAT_INTERVAL: 30000,
    },

    staging: {
        SERVER_HOST: "staging.yourdomain.com",
        SERVER_PORT: 443,
        WS_PROTOCOL: "wss",
        ENABLE_LOGGING: true,
        ENABLE_DEBUG: false,
        API_TIMEOUT: 15000,
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_ATTEMPTS: 3,
        HEARTBEAT_INTERVAL: 60000,
    },

    production: {
        SERVER_HOST: "yourdomain.com",
        SERVER_PORT: 443,
        WS_PROTOCOL: "wss",
        ENABLE_LOGGING: false,
        ENABLE_DEBUG: false,
        API_TIMEOUT: 20000,
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_ATTEMPTS: 3,
        HEARTBEAT_INTERVAL: 60000,
    },
};

/**
 * Get current environment
 */
function getCurrentEnv() {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "development";
    }

    if (hostname.includes("staging")) {
        return "staging";
    }

    return "production";
}

/**
 * Configuration class
 */
class Config {
    constructor() {
        this.env = getCurrentEnv();
        this.config = ENV[this.env];

        // Allow override from localStorage
        this.loadOverrides();
    }

    /**
     * Get config value
     */
    get(key, defaultValue = null) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Set config value (only in development)
     */
    set(key, value) {
        if (this.env !== "development") {
            console.warn("Cannot modify config in non-development environment");
            return;
        }

        this.config[key] = value;
        this.saveOverrides();
    }

    /**
     * Load overrides from localStorage
     */
    loadOverrides() {
        try {
            const overrides = localStorage.getItem("config_overrides");
            if (overrides) {
                const parsed = JSON.parse(overrides);
                this.config = { ...this.config, ...parsed };
            }
        } catch (err) {
            console.error("Failed to load config overrides:", err);
        }
    }

    /**
     * Save overrides to localStorage
     */
    saveOverrides() {
        try {
            const overrides = {};
            const defaultConfig = ENV[this.env];

            // Only save values that differ from default
            for (const [key, value] of Object.entries(this.config)) {
                if (defaultConfig[key] !== value) {
                    overrides[key] = value;
                }
            }

            localStorage.setItem("config_overrides", JSON.stringify(overrides));
        } catch (err) {
            console.error("Failed to save config overrides:", err);
        }
    }

    /**
     * Reset to default config
     */
    reset() {
        this.config = { ...ENV[this.env] };
        localStorage.removeItem("config_overrides");
    }

    /**
     * Get all config values
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Get WebSocket URL
     */
    getWebSocketUrl() {
        const protocol = this.get("WS_PROTOCOL");
        const host = this.get("SERVER_HOST");
        const port = this.get("SERVER_PORT");

        // Use default port for ws/wss
        if (
            (protocol === "ws" && port === 80) ||
            (protocol === "wss" && port === 443)
        ) {
            return `${protocol}://${host}`;
        }

        return `${protocol}://${host}:${port}`;
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugEnabled() {
        return this.get("ENABLE_DEBUG", false);
    }

    /**
     * Check if logging is enabled
     */
    isLoggingEnabled() {
        return this.get("ENABLE_LOGGING", false);
    }

    /**
     * Log message (only if logging enabled)
     */
    log(...args) {
        if (this.isLoggingEnabled()) {
            console.log("[Config]", ...args);
        }
    }

    /**
     * Debug message (only if debug enabled)
     */
    debug(...args) {
        if (this.isDebugEnabled()) {
            console.debug("[Debug]", ...args);
        }
    }
}

// Create singleton instance
export const config = new Config();

// Export for testing
export { ENV, getCurrentEnv };
