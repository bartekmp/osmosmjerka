/**
 * Utility function to get the base URL that works in both browser and test environments
 */

/**
 * Get the base URL for the application
 * Works in both browser and Jest environments
 */
export function getBaseUrl() {
    // In Jest environment, use environment variable
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
        return process.env.VITE_BASE_PATH || '/';
    }

    // In browser environment, check if we're in production
    if (typeof window !== 'undefined') {
        // First check if VITE_BASE_PATH was injected at build time
        if (typeof __VITE_BASE_PATH__ !== 'undefined') {
            return __VITE_BASE_PATH__;
        }

        // Check if we're in production mode by multiple indicators
        const isProduction =
            // Check if current URL suggests we're being served from /static/
            window.location.pathname.startsWith('/static/') ||
            // Check traditional NODE_ENV
            (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') ||
            // Check if we're NOT running on development ports
            (window.location.port !== '3210' && window.location.port !== '5173' && window.location.hostname !== 'localhost');

        return isProduction ? '/static/' : '/';
    }

    // Fallback
    return '/';
}

export const getAssetUrl = (path) => {
    const baseUrl = getBaseUrl();
    // Remove leading slash from path if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const finalUrl = `${baseUrl}${cleanPath}`;
    return finalUrl;
};
