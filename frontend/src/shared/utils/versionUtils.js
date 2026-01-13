/**
 * Version comparison and tracking utilities for What's New feature
 */

import { STORAGE_KEYS } from '../constants/constants';

/**
 * Compare two semantic version strings
 * @param {string} v1 - First version (e.g., "1.38.0")
 * @param {string} v2 - Second version (e.g., "1.37.5")
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
    if (!v1 && !v2) return 0;
    if (!v1) return -1;
    if (!v2) return 1;

    // Remove 'v' prefix if present
    const normalize = (v) => v.replace(/^v/, '');

    const parts1 = normalize(v1).split('.').map(Number);
    const parts2 = normalize(v2).split('.').map(Number);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

/**
 * Check if current version is newer than last seen version
 * @param {string} current - Current app version
 * @param {string} lastSeen - Last seen version from storage
 * @returns {boolean} True if current is newer than lastSeen
 */
export function isNewerVersion(current, lastSeen) {
    if (!lastSeen) return true; // Never seen before, show what's new
    return compareVersions(current, lastSeen) > 0;
}

/**
 * Get the last seen version from localStorage
 * @returns {string|null} The last seen version or null
 */
export function getLastSeenVersion() {
    try {
        return localStorage.getItem(STORAGE_KEYS.LAST_SEEN_VERSION);
    } catch {
        return null;
    }
}

/**
 * Save the current version as the last seen version
 * @param {string} version - Version to save
 */
export function setLastSeenVersion(version) {
    try {
        localStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, version);
    } catch (error) {
        console.warn('Failed to save last seen version:', error);
    }
}

/**
 * Clear the last seen version (useful for testing)
 */
export function clearLastSeenVersion() {
    try {
        localStorage.removeItem(STORAGE_KEYS.LAST_SEEN_VERSION);
    } catch (error) {
        console.warn('Failed to clear last seen version:', error);
    }
}

/**
 * API endpoints for changelog
 */
const API_VERSION_URL = '/api/version';
const API_WHATS_NEW_URL = '/api/whats-new';

/**
 * Fetch changelog entries from the backend API
 * @param {string} sinceVersion - Only include releases newer than this version
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} Array of changelog entries
 */
export async function fetchWhatsNew(sinceVersion = null, limit = 5) {
    try {
        let url = `${API_WHATS_NEW_URL}?limit=${limit}`;
        if (sinceVersion) {
            url += `&since=${encodeURIComponent(sinceVersion)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            console.warn('Failed to fetch changelog:', response.status);
            return [];
        }

        const data = await response.json();
        return data.entries || [];
    } catch (error) {
        console.error('Error fetching changelog:', error);
        return [];
    }
}

/**
 * Get the current app version from the backend API
 * @returns {Promise<string|null>} The current version or null
 */
export async function getCurrentVersion() {
    // Try to get version from Vite env if available
    // Note: import.meta is wrapped in try-catch for Jest compatibility
    try {
        if (typeof __VITE_APP_VERSION__ !== 'undefined') {
            // eslint-disable-next-line no-undef
            return __VITE_APP_VERSION__;
        }
    } catch {
        // Vite env not available (e.g., in tests)
    }

    // Fetch from backend API
    try {
        const response = await fetch(API_VERSION_URL);
        if (response.ok) {
            const data = await response.json();
            return data.version;
        }
    } catch (error) {
        console.warn('Could not fetch current version:', error);
    }

    return null;
}

