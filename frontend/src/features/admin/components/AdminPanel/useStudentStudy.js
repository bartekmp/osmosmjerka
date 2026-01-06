import { useCallback, useMemo, useState } from 'react';

/**
 * API hook for Student Study management (Groups & Puzzles).
 */
export function useStudentStudy({ token, setError }) {
    const [loading, setLoading] = useState(false);

    const authHeader = useMemo(() => token
        ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' }, [token]);

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
                const errorMessage = data.detail || data.message || 'Request failed';
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
