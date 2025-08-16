import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for debouncing function calls
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Array} deps - Dependencies array for useCallback
 * @returns {Object} - { debouncedFn, isDebouncing, cancel }
 */
export const useDebounce = (callback, delay, deps = []) => {
    const [isDebouncing, setIsDebouncing] = useState(false);
    const timeoutRef = useRef(null);

    const debouncedFn = useCallback((...args) => {
        setIsDebouncing(true);
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args);
            setIsDebouncing(false);
        }, delay);
    }, [callback, delay, ...deps]);

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            setIsDebouncing(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return { debouncedFn, isDebouncing, cancel };
};

/**
 * Custom hook for debouncing values
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - Debounced value
 */
export const useDebouncedValue = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Custom hook for debounced API calls with rate limit warning
 * @param {Function} apiCall - API function to call
 * @param {number} delay - Debounce delay in milliseconds
 * @param {Object} options - Additional options
 * @returns {Object} - { call, isLoading, error, showRateLimit }
 */
export const useDebouncedApiCall = (apiCall, delay = 750, options = {}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showRateLimit, setShowRateLimit] = useState(false);
    const { onSuccess, onError } = options;

    const debouncedCall = useCallback(async (...args) => {
        if (isLoading) {
            setShowRateLimit(true);
            setTimeout(() => setShowRateLimit(false), 3000);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await apiCall(...args);
            if (onSuccess) onSuccess(result);
            return result;
        } catch (err) {
            setError(err);
            if (err.response?.status === 429) {
                setShowRateLimit(true);
                setTimeout(() => setShowRateLimit(false), 4000);
            }
            if (onError) onError(err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [apiCall, isLoading, onSuccess, onError]);

    const { debouncedFn: call } = useDebounce(debouncedCall, delay);

    return { call, isLoading, error, showRateLimit };
};
