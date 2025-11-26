/**
 * Validation utilities
 */

export const Validators = {
    /**
     * Validate username
     * - 3-20 characters
     * - Alphanumeric + underscore
     * - Cannot start with number
     */
    username(username) {
        if (!username || typeof username !== "string") {
            return { valid: false, error: "Username is required" };
        }

        if (username.length < 3) {
            return {
                valid: false,
                error: "Username must be at least 3 characters",
            };
        }

        if (username.length > 20) {
            return {
                valid: false,
                error: "Username must not exceed 20 characters",
            };
        }

        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
            return {
                valid: false,
                error: "Username must start with letter and contain only letters, numbers, and underscore",
            };
        }

        return { valid: true };
    },

    /**
     * Validate email
     */
    email(email) {
        if (!email || typeof email !== "string") {
            return { valid: false, error: "Email is required" };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: "Invalid email format" };
        }

        return { valid: true };
    },

    /**
     * Validate password
     * - 8-50 characters
     * - At least 1 uppercase
     * - At least 1 lowercase
     * - At least 1 number
     */
    password(password) {
        if (!password || typeof password !== "string") {
            return { valid: false, error: "Password is required" };
        }

        if (password.length < 8) {
            return {
                valid: false,
                error: "Password must be at least 8 characters",
            };
        }

        if (password.length > 50) {
            return {
                valid: false,
                error: "Password must not exceed 50 characters",
            };
        }

        if (!/[A-Z]/.test(password)) {
            return {
                valid: false,
                error: "Password must contain at least 1 uppercase letter",
            };
        }

        if (!/[a-z]/.test(password)) {
            return {
                valid: false,
                error: "Password must contain at least 1 lowercase letter",
            };
        }

        if (!/[0-9]/.test(password)) {
            return {
                valid: false,
                error: "Password must contain at least 1 number",
            };
        }

        return { valid: true };
    },

    /**
     * Validate server host
     */
    host(host) {
        if (!host || typeof host !== "string") {
            return { valid: false, error: "Server host is required" };
        }

        // IP address or domain name
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const domainRegex =
            /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;

        if (host === "localhost") {
            return { valid: true };
        }

        if (ipRegex.test(host)) {
            // Validate IP range
            const parts = host.split(".");
            if (parts.some((part) => parseInt(part) > 255)) {
                return { valid: false, error: "Invalid IP address" };
            }
            return { valid: true };
        }

        if (domainRegex.test(host)) {
            return { valid: true };
        }

        return { valid: false, error: "Invalid server host format" };
    },

    /**
     * Validate port
     */
    port(port) {
        const portNum = parseInt(port);

        if (isNaN(portNum)) {
            return { valid: false, error: "Port must be a number" };
        }

        if (portNum < 1 || portNum > 65535) {
            return { valid: false, error: "Port must be between 1 and 65535" };
        }

        return { valid: true };
    },
};

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(text) {
    if (!text) return "";

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize for display (escape HTML but preserve newlines)
 */
export function sanitizeForDisplay(text) {
    if (!text) return "";

    return sanitizeHTML(text)
        .replace(/\n/g, "<br>")
        .replace(/\s{2,}/g, (match) => "&nbsp;".repeat(match.length));
}

/**
 * Validate and sanitize chat message
 */
export function validateChatMessage(message) {
    if (!message || typeof message !== "string") {
        return { valid: false, error: "Message is required" };
    }

    if (message.trim().length === 0) {
        return { valid: false, error: "Message cannot be empty" };
    }

    if (message.length > 500) {
        return { valid: false, error: "Message too long (max 500 characters)" };
    }

    // Check for spam patterns
    if (/(.)\1{10,}/.test(message)) {
        return { valid: false, error: "Message contains spam pattern" };
    }

    return { valid: true, sanitized: sanitizeHTML(message) };
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
