import apiClient from '@shared/utils/apiClient';
import { useCallback, useMemo, useState } from 'react';

/**
 * API hook for Groups management in Teacher Mode.
 */
export function useGroups({ setError }) {
    const [loading, setLoading] = useState(false);


    /**
     * Make an authenticated API request
     */
    const apiRequest = useCallback(async (url, options = {}) => {
        setLoading(true);
        try {
            // Callers pass fetch-shaped options ({ method, body: JSON.stringify(..) });
            // axios forwards a string `data` verbatim, so bodies need no re-encoding.
            const { method = 'GET', body, headers } = options;
            const response = await apiClient.request({
                url,
                method,
                data: body,
                headers: { 'Content-Type': 'application/json', ...headers },
            });
            return response.data;
        } catch (error) {
            // axios rejects on non-2xx, so the message the old !response.ok branch read
            // off the parsed body now lives on error.response.data.
            const payload = error.response?.data;
            const errorMessage = payload?.message || payload?.error_code || error.message || 'Request failed';
            if (setError) {
                setError(errorMessage);
            }
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [setError]);

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
     * Invite members to group (bulk support)
     * @param {number} groupId
     * @param {string[]} usernames - Array of usernames to invite
     */
    const inviteMembers = useCallback(async (groupId, usernames) => {
        return apiRequest(`/admin/teacher/groups/${groupId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ usernames }),
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
        inviteMembers,
        removeMember,
    }), [
        loading,
        fetchGroups,
        createGroup,
        getGroup,
        deleteGroup,
        fetchGroupMembers,
        inviteMembers,
        removeMember,
    ]);
}

export default useGroups;
