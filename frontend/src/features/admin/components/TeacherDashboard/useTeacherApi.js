import { useCallback, useMemo, useState } from 'react';

/**
 * API hook for Teacher Mode functionality.
 * Handles all teacher phrase set CRUD operations and session management.
 */
export function useTeacherApi({ token, setError }) {
    const [loading, setLoading] = useState(false);

    const authHeader = useMemo(() => token
        ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' }, [token]);

    /**
     * Make an authenticated API request
     */
    const apiRequest = useCallback(async (url, options = {}) => {
        setLoading(true);
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...authHeader,
                    ...options.headers,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.message || data.error_code || 'Request failed';
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            if (setError) {
                setError(error.message);
            }
            throw error;
        } finally {
            setLoading(false);
        }
    }, [authHeader, setError]);

    // =========================================================================
    // Phrase Set CRUD
    // =========================================================================

    /**
     * Fetch list of phrase sets
     */
    const fetchPhraseSets = useCallback(async (options = {}) => {
        const { offset = 0, limit = 20, activeOnly = true } = options;
        const params = new URLSearchParams({
            offset: offset.toString(),
            limit: limit.toString(),
            active_only: activeOnly.toString(),
        });
        return apiRequest(`/admin/teacher/phrase-sets?${params}`);
    }, [apiRequest]);

    /**
     * Create a new phrase set
     */
    const createPhraseSet = useCallback(async (data) => {
        return apiRequest('/admin/teacher/phrase-sets', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }, [apiRequest]);

    /**
     * Get a specific phrase set by ID
     */
    const getPhraseSet = useCallback(async (setId) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}`);
    }, [apiRequest]);

    /**
     * Update a phrase set
     */
    const updatePhraseSet = useCallback(async (setId, data) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }, [apiRequest]);

    /**
     * Delete a phrase set
     */
    const deletePhraseSet = useCallback(async (setId) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}`, {
            method: 'DELETE',
        });
    }, [apiRequest]);

    // =========================================================================
    // Link Management
    // =========================================================================

    /**
     * Regenerate hotlink for a phrase set
     */
    const regenerateLink = useCallback(async (setId) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}/regenerate-link`, {
            method: 'POST',
        });
    }, [apiRequest]);

    /**
     * Extend auto-delete date
     */
    const extendLifetime = useCallback(async (setId, days) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}/extend`, {
            method: 'POST',
            body: JSON.stringify({ days }),
        });
    }, [apiRequest]);

    // =========================================================================
    // Session Management
    // =========================================================================

    /**
     * Fetch sessions for a phrase set
     */
    const fetchSessions = useCallback(async (setId, options = {}) => {
        const { offset = 0, limit = 50, completedOnly = false } = options;
        const params = new URLSearchParams({
            offset: offset.toString(),
            limit: limit.toString(),
            completed_only: completedOnly.toString(),
        });
        return apiRequest(`/admin/teacher/phrase-sets/${setId}/sessions?${params}`);
    }, [apiRequest]);

    /**
     * Delete a session
     */
    const deleteSession = useCallback(async (sessionId) => {
        return apiRequest(`/admin/teacher/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    }, [apiRequest]);

    /**
     * Delete all sessions for a phrase set
     */
    const deleteAllSessions = useCallback(async (setId) => {
        return apiRequest(`/admin/teacher/phrase-sets/${setId}/sessions`, {
            method: 'DELETE',
        });
    }, [apiRequest]);

    // =========================================================================
    // Utility
    // =========================================================================

    /**
     * Generate shareable link URL
     */
    const getShareableLink = useCallback((token) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/t/${token}`;
    }, []);

    /**
     * Copy link to clipboard
     */
    const copyLinkToClipboard = useCallback(async (token) => {
        const link = getShareableLink(token);
        try {
            await navigator.clipboard.writeText(link);
            return true;
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = link;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    }, [getShareableLink]);

    return useMemo(() => ({
        isLoading: loading,
        // Phrase Set CRUD
        fetchPhraseSets,
        createPhraseSet,
        getPhraseSet,
        updatePhraseSet,
        deletePhraseSet,
        // Link Management
        regenerateLink,
        extendLifetime,
        // Session Management
        fetchSessions,
        deleteSession,
        deleteAllSessions,
        // Utility
        getShareableLink,
        copyLinkToClipboard,
    }), [
        loading,
        fetchPhraseSets,
        createPhraseSet,
        getPhraseSet,
        updatePhraseSet,
        deletePhraseSet,
        regenerateLink,
        extendLifetime,
        fetchSessions,
        deleteSession,
        deleteAllSessions,
        getShareableLink,
        copyLinkToClipboard
    ]);
}

export default useTeacherApi;
