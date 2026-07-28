import apiClient from '@shared/utils/apiClient';
import logger from '@shared/utils/logger';
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
            const response = await apiClient.get(`${API_ENDPOINTS.ADMIN}/notifications?limit=20`);
            setNotifications(response.data);

            // The list is capped at 20, so the unread count comes from its own endpoint.
            const countRes = await apiClient.get(`${API_ENDPOINTS.ADMIN}/notifications/unread-count`);
            setUnreadCount(countRes.data.count);
        } catch (error) {
            logger.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [token, isLogged]);

    const markAsRead = useCallback(async (id) => {
        try {
            await apiClient.put(`${API_ENDPOINTS.ADMIN}/notifications/${id}/read`);
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            logger.error('Failed to mark notification as read:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await apiClient.put(`${API_ENDPOINTS.ADMIN}/notifications/read-all`);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            logger.error('Failed to mark all as read:', error);
        }
    }, []);

    const deleteNotification = useCallback(async (id) => {
        try {
            await apiClient.delete(`${API_ENDPOINTS.ADMIN}/notifications/${id}`);
            // Read the target from current state rather than from inside the
            // setNotifications updater: React may invoke updaters more than once
            // (StrictMode does so deliberately), which double-decremented the count.
            const target = notifications.find(n => n.id === id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (target && !target.is_read) {
                setUnreadCount(c => Math.max(0, c - 1));
            }
        } catch (error) {
            logger.error('Failed to delete notification:', error);
        }
    }, [notifications]);

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
