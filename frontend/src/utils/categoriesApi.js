import axios from 'axios';
import { API_ENDPOINTS } from '../shared/constants/constants';

// Cache for categories to avoid frequent API calls
let categoriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch categories with caching
 * @returns {Promise<string[]>} Array of category names
 */
export const fetchCategories = async () => {
    // Check if we have valid cached data
    const now = Date.now();
    if (categoriesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
        return categoriesCache;
    }

    try {
        const response = await axios.get(API_ENDPOINTS.CATEGORIES);
        categoriesCache = response.data;
        cacheTimestamp = now;
        return categoriesCache;
    } catch (error) {
        console.error('Error fetching categories:', error);
        // Return empty array on error, but don't cache it
        return [];
    }
};

/**
 * Invalidate the categories cache
 * Call this when adding/updating words with new categories
 */
export const invalidateCategoriesCache = () => {
    categoriesCache = null;
    cacheTimestamp = null;
};

/**
 * Check if categories cache is valid
 * @returns {boolean} True if cache is valid
 */
export const isCategoriesCacheValid = () => {
    const now = Date.now();
    return categoriesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION);
};

/**
 * Get cached categories without making API call
 * @returns {string[]|null} Cached categories or null if not cached
 */
export const getCachedCategories = () => {
    if (isCategoriesCacheValid()) {
        return categoriesCache;
    }
    return null;
};
