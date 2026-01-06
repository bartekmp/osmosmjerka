import { useState, useCallback, useEffect } from 'react';
import { API_ENDPOINTS } from '@shared';

export const useNotifications = (token, isLogged) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!token || !isLogged) return;

        try {
            setLoading(true);
            const response = await fetch(`${API_ENDPOINTS.ADMIN}/notifications?limit=20`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setNotifications(data);

                // Calculate unread count from list or fetch separately if list is partial?
                // For accurate count, better to fetch count or trust the list if small.
                // But let's fetch count too or rely on list if we assume 20 covers most.
                // Let's use the explicit endpoint for count.
                const countRes = await fetch(`${API_ENDPOINTS.ADMIN}/notifications/unread-count`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (countRes.ok) {
                    const countData = await countRes.json();
                    setUnreadCount(countData.count);
                }
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [token, isLogged]);

    const markAsRead = useCallback(async (id) => {
        try {
            await fetch(`${API_ENDPOINTS.ADMIN}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }, [token]);

    const markAllAsRead = useCallback(async () => {
        try {
            await fetch(`${API_ENDPOINTS.ADMIN}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    }, [token]);

    const deleteNotification = useCallback(async (id) => {
        try {
            await fetch(`${API_ENDPOINTS.ADMIN}/notifications/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => {
                const target = prev.find(n => n.id === id);
                if (target && !target.is_read) {
                    setUnreadCount(c => Math.max(0, c - 1));
                }
                return prev.filter(n => n.id !== id);
            });
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    }, [token]);

    // Initial fetch
    useEffect(() => {
        fetchNotifications();
        // Poll every 60s
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification
    };
};
