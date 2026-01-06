
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import { API_ENDPOINTS } from '@shared';

// Mock fetch
global.fetch = jest.fn();

describe('useNotifications', () => {
    const mockToken = 'test-token';
    const mockNotifications = [
        { id: 1, title: 'Test 1', is_read: false },
        { id: 2, title: 'Test 2', is_read: true }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockNotifications
        });
    });

    test('should fetch notifications on mount', async () => {
        const { result } = renderHook(() => useNotifications(mockToken, true));

        // Initial state
        expect(result.current.loading).toBe(true);

        // Wait for load
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.notifications).toEqual(mockNotifications);
        expect(fetch).toHaveBeenCalledWith(`${API_ENDPOINTS.ADMIN}/notifications?limit=20`, expect.any(Object));
    });

    test('should not fetch if not logged in', () => {
        renderHook(() => useNotifications(mockToken, false));
        expect(fetch).not.toHaveBeenCalled();
    });

    test('should fetch unread count', async () => {
        // Mock first call (notifications)
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockNotifications)
        }));
        // Mock second call (count)
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ count: 5 })
        }));

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(5);
    });

    test('markAsRead should update state optimistically', async () => {
        // Initial fetch notifications
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifications });
        // Initial fetch count
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 5 }) });
        // subsequent markRead call
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Ensure data is loaded
        expect(result.current.notifications).toHaveLength(2);

        await act(async () => {
            await result.current.markAsRead(1);
        });

        // Verify API call
        expect(fetch).toHaveBeenCalledWith(
            `${API_ENDPOINTS.ADMIN}/notifications/1/read`,
            expect.objectContaining({ method: 'PUT' })
        );

        // Verify state update
        const updatedNotif = result.current.notifications.find(n => n.id === 1);
        expect(updatedNotif.is_read).toBe(true);
    });

    test('markAllAsRead should update all to read', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifications });
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 5 }) });
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(fetch).toHaveBeenCalledWith(
            `${API_ENDPOINTS.ADMIN}/notifications/read-all`,
            expect.objectContaining({ method: 'PUT' })
        );

        expect(result.current.notifications.every(n => n.is_read)).toBe(true);
        expect(result.current.unreadCount).toBe(0);
    });

    test('deleteNotification should remove from list', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifications });
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 5 }) });
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.deleteNotification(1);
        });

        expect(fetch).toHaveBeenCalledWith(
            `${API_ENDPOINTS.ADMIN}/notifications/1`,
            expect.objectContaining({ method: 'DELETE' })
        );

        expect(result.current.notifications.find(n => n.id === 1)).toBeUndefined();
    });
});
