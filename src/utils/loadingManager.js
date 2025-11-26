/**
 * Loading state manager
 */

class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
        this.setupGlobalLoader();
    }

    setupGlobalLoader() {
        // Create global loading overlay
        const overlay = document.createElement("div");
        overlay.id = "global-loading";
        overlay.className = "loading-overlay";
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p class="loading-text">Đang tải...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Show loading for specific operation
     */
    show(operationId = "default", text = "Đang tải...") {
        this.activeLoaders.add(operationId);

        const overlay = document.getElementById("global-loading");
        const textElement = overlay.querySelector(".loading-text");
        textElement.textContent = text;
        overlay.classList.add("active");
    }

    /**
     * Hide loading for specific operation
     */
    hide(operationId = "default") {
        this.activeLoaders.delete(operationId);

        // Only hide if no active loaders
        if (this.activeLoaders.size === 0) {
            const overlay = document.getElementById("global-loading");
            overlay.classList.remove("active");
        }
    }

    /**
     * Wrap async function with loading state
     */
    wrapAsync(fn, operationId, loadingText) {
        return async (...args) => {
            this.show(operationId, loadingText);
            try {
                return await fn(...args);
            } finally {
                this.hide(operationId);
            }
        };
    }

    /**
     * Show skeleton loader for element
     */
    showSkeleton(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add("skeleton-loader");
        }
    }

    /**
     * Hide skeleton loader for element
     */
    hideSkeleton(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove("skeleton-loader");
        }
    }

    /**
     * Show inline spinner in button
     */
    showButtonLoader(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.dataset.originalText = button.textContent;
            button.disabled = true;
            button.innerHTML =
                '<span class="btn-spinner"></span> Đang xử lý...';
        }
    }

    /**
     * Hide inline spinner in button
     */
    hideButtonLoader(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.textContent = button.dataset.originalText || "Submit";
        }
    }
}

// Create singleton
export const loadingManager = new LoadingManager();

/**
 * Convenience functions
 */
export function showLoading(operationId, text) {
    loadingManager.show(operationId, text);
}

export function hideLoading(operationId) {
    loadingManager.hide(operationId);
}

export function withLoading(fn, operationId, loadingText) {
    return loadingManager.wrapAsync(fn, operationId, loadingText);
}
