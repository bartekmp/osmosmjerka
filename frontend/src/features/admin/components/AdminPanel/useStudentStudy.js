import apiClient from '@shared/utils/apiClient';
import { useCallback, useMemo, useState } from 'react';

/**
 * API hook for Student Study management (Groups & Puzzles).
 */
export function useStudentStudy({ setError }) {
    const [loading, setLoading] = useState(false);


    const apiRequest = useCallback(async (url, options = {}) => {
        setLoading(true);
        try {
            // Callers still pass fetch-shaped options ({ method, body: JSON.stringify(..) }).
            // axios sends a string `data` verbatim, so the bodies need no re-encoding.
            const { method = 'GET', body, headers } = options;
            const response = await apiClient.request({
                url,
                method,
                data: body,
                headers: { 'Content-Type': 'application/json', ...headers },
            });
            return response.data;
        } catch (error) {
            // axios throws on non-2xx, so the detail/message the old !response.ok branch
            // read off the parsed body now lives on error.response.data.
            const payload = error.response?.data;
            const errorMessage = payload?.detail || payload?.message || error.message || 'Request failed';
            if (setError) {
                setError(errorMessage);
            }
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [setError]);

    const fetchMyGroups = useCallback(async () => {
        return apiRequest('/api/user/groups');
    }, [apiRequest]);

    const fetchInvitations = useCallback(async () => {
        return apiRequest('/api/user/groups/invitations');
    }, [apiRequest]);

    const acceptInvitation = useCallback(async (invitationId) => {
        return apiRequest(`/api/user/groups/invitations/${invitationId}/accept`, {
            method: 'POST',
        });
    }, [apiRequest]);

    const declineInvitation = useCallback(async (invitationId) => {
        return apiRequest(`/api/user/groups/invitations/${invitationId}/decline`, {
            method: 'POST',
        });
    }, [apiRequest]);

    const leaveGroup = useCallback(async (groupId) => {
        return apiRequest(`/api/user/groups/${groupId}/leave`, {
            method: 'POST',
        });
    }, [apiRequest]);

    const fetchAssignedPuzzles = useCallback(async () => {
        return apiRequest('/api/user/study/puzzles');
    }, [apiRequest]);

    return useMemo(() => ({
        isLoading: loading,
        fetchMyGroups,
        fetchInvitations,
        acceptInvitation,
        declineInvitation,
        leaveGroup,
        fetchAssignedPuzzles,
    }), [
        loading,
        fetchMyGroups,
        fetchInvitations,
        acceptInvitation,
        declineInvitation,
        leaveGroup,
        fetchAssignedPuzzles,
    ]);
}

export default useStudentStudy;
