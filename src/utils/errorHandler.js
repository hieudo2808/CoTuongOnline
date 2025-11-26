/**
 * Global error handler
 */

class ErrorHandler {
    constructor() {
        this.listeners = [];
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Handle uncaught errors
        window.addEventListener("error", (event) => {
            this.handleError(event.error || new Error(event.message));
            event.preventDefault();
        });

        // Handle unhandled promise rejections
        window.addEventListener("unhandledrejection", (event) => {
            this.handleError(event.reason);
            event.preventDefault();
        });
    }

    /**
     * Register error listener
     */
    onError(callback) {
        this.listeners.push(callback);
    }

    /**
     * Handle error
     */
    handleError(error, context = {}) {
        console.error("Error:", error, context);

        // Notify listeners
        this.listeners.forEach((listener) => {
            try {
                listener(error, context);
            } catch (err) {
                console.error("Error in error listener:", err);
            }
        });

        // Show user-friendly message
        this.showErrorToUser(error, context);

        // Log to server (if connected)
        this.logToServer(error, context);
    }

    /**
     * Show error to user
     */
    showErrorToUser(error, context) {
        let message = "An error occurred. Please try again.";
        let title = "Error";

        // Categorize errors
        if (error instanceof NetworkError) {
            title = "Connection Error";
            message =
                error.message ||
                "Unable to connect to server. Please check your connection.";
        } else if (error instanceof ValidationError) {
            title = "Invalid Input";
            message = error.message || "Please check your input and try again.";
        } else if (error instanceof AuthenticationError) {
            title = "Authentication Error";
            message = error.message || "Please login again.";
        } else if (error instanceof GameError) {
            title = "Game Error";
            message = error.message || "An error occurred in the game.";
        } else if (error.message) {
            message = error.message;
        }

        // Show modal
        this.showErrorModal(title, message, context);
    }

    /**
     * Show error modal
     */
    showErrorModal(title, message, context) {
        // Create modal if doesn't exist
        let modal = document.getElementById("error-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "error-modal";
            modal.className = "modal";
            modal.innerHTML = `
                <div class="modal-content error-modal-content">
                    <div class="error-icon">⚠️</div>
                    <h2 class="error-title"></h2>
                    <p class="error-message"></p>
                    <button class="btn btn-primary error-close-btn">OK</button>
                </div>
            `;
            document.body.appendChild(modal);

            modal
                .querySelector(".error-close-btn")
                .addEventListener("click", () => {
                    modal.classList.remove("show");
                });
        }

        // Update content
        modal.querySelector(".error-title").textContent = title;
        modal.querySelector(".error-message").textContent = message;

        // Show modal
        modal.classList.add("show");

        // Auto-hide after 5 seconds for non-critical errors
        if (!context.critical) {
            setTimeout(() => {
                modal.classList.remove("show");
            }, 5000);
        }
    }

    /**
     * Log error to server
     */
    async logToServer(error, context) {
        try {
            // Only log in production
            if (window.location.hostname === "localhost") {
                return;
            }

            const errorData = {
                message: error.message,
                stack: error.stack,
                context: context,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            };

            // Send to logging endpoint (implement later)
            // await fetch('/api/log-error', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(errorData)
            // });
        } catch (err) {
            console.error("Failed to log error to server:", err);
        }
    }

    /**
     * Wrap async function with error handling
     */
    wrapAsync(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, { ...context, args });
                throw error;
            }
        };
    }

    /**
     * Wrap sync function with error handling
     */
    wrapSync(fn, context = {}) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError(error, { ...context, args });
                throw error;
            }
        };
    }
}

/**
 * Custom error types
 */
export class NetworkError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "NetworkError";
        this.details = details;
    }
}

export class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
    }
}

export class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthenticationError";
    }
}

export class GameError extends Error {
    constructor(message, code = null) {
        super(message);
        this.name = "GameError";
        this.code = code;
    }
}

export class TimeoutError extends Error {
    constructor(message, duration = null) {
        super(message);
        this.name = "TimeoutError";
        this.duration = duration;
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience function
export function handleError(error, context = {}) {
    errorHandler.handleError(error, context);
}
