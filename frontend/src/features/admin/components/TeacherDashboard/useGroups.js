import { useCallback, useMemo, useState } from 'react';

/**
 * API hook for Groups management in Teacher Mode.
 */
export function useGroups({ token, setError }) {
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

    /**
     * Fetch list of groups
     */
    const fetchGroups = useCallback(async () => {
        return apiRequest('/admin/teacher/groups');
    }, [apiRequest]);

    /**
     * Create a new group
     */
    const createGroup = useCallback(async (name) => {
        return apiRequest('/admin/teacher/groups', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }, [apiRequest]);

    /**
     * Get specific group details
     */
    const getGroup = useCallback(async (groupId) => {
        return apiRequest(`/admin/teacher/groups/${groupId}`);
    }, [apiRequest]);

    /**
     * Delete a group
     */
    const deleteGroup = useCallback(async (groupId) => {
        return apiRequest(`/admin/teacher/groups/${groupId}`, {
            method: 'DELETE',
        });
    }, [apiRequest]);

    /**
     * Fetch group members
     */
    const fetchGroupMembers = useCallback(async (groupId) => {
        return apiRequest(`/admin/teacher/groups/${groupId}/members`);
    }, [apiRequest]);

    /**
     * Add member to group
     */
    const addMember = useCallback(async (groupId, username) => {
        return apiRequest(`/admin/teacher/groups/${groupId}/members`, {
            method: 'POST',
            body: JSON.stringify({ username }),
        });
    }, [apiRequest]);

    /**
     * Remove member from group
     */
    const removeMember = useCallback(async (groupId, userId) => {
        return apiRequest(`/admin/teacher/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
        });
    }, [apiRequest]);

    return useMemo(() => ({
        isLoading: loading,
        fetchGroups,
        createGroup,
        getGroup,
        deleteGroup,
        fetchGroupMembers,
        addMember,
        removeMember,
    }), [
        loading,
        fetchGroups,
        createGroup,
        getGroup,
        deleteGroup,
        fetchGroupMembers,
        addMember,
        removeMember,
    ]);
}

export default useGroups;
