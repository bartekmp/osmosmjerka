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
        // Check if we're in production mode by looking for the /static/ path pattern
        // This matches our Vite config setup
        const isProduction = window.location.pathname.startsWith('/static/') ||
            (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
        return isProduction ? '/static/' : '/';
    }

    // Fallback
    return '/';
}

export const getAssetUrl = (path) => {
    const baseUrl = getBaseUrl();
    // Remove leading slash from path if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${baseUrl}${cleanPath}`;
};
