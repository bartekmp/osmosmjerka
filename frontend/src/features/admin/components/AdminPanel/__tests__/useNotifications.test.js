
import { renderHook, act, waitFor } from '@testing-library/react';
import apiClient from '@shared/utils/apiClient';
import { useNotifications } from '../useNotifications';
import { API_ENDPOINTS } from '@shared';

// The hook uses the shared API client; its interceptor supplies the Authorization
// header, so these tests assert on URLs and verbs only.
jest.mock('@shared/utils/apiClient', () => ({
    __esModule: true,
    default: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

describe('useNotifications', () => {
    const mockToken = 'test-token';
    const mockNotifications = [
        { id: 1, title: 'Test 1', is_read: false },
        { id: 2, title: 'Test 2', is_read: true }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        apiClient.get.mockResolvedValue({ data: mockNotifications });
        apiClient.put.mockResolvedValue({ data: {} });
        apiClient.delete.mockResolvedValue({ data: {} });
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
        expect(apiClient.get).toHaveBeenCalledWith(`${API_ENDPOINTS.ADMIN}/notifications?limit=20`);
    });

    test('should not fetch if not logged in', () => {
        renderHook(() => useNotifications(mockToken, false));
        expect(apiClient.get).not.toHaveBeenCalled();
    });

    test('should fetch unread count', async () => {
        // Mock first call (notifications)
        apiClient.get
            .mockResolvedValueOnce({ data: mockNotifications })
            .mockResolvedValueOnce({ data: { count: 5 } });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(5);
    });

    test('markAsRead should update state optimistically', async () => {
        apiClient.get
            .mockResolvedValueOnce({ data: mockNotifications })
            .mockResolvedValueOnce({ data: { count: 5 } });

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
        expect(apiClient.put).toHaveBeenCalledWith(`${API_ENDPOINTS.ADMIN}/notifications/1/read`);

        // Verify state update
        const updatedNotif = result.current.notifications.find(n => n.id === 1);
        expect(updatedNotif.is_read).toBe(true);
    });

    test('markAllAsRead should update all to read', async () => {
        apiClient.get
            .mockResolvedValueOnce({ data: mockNotifications })
            .mockResolvedValueOnce({ data: { count: 5 } });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(apiClient.put).toHaveBeenCalledWith(`${API_ENDPOINTS.ADMIN}/notifications/read-all`);

        expect(result.current.notifications.every(n => n.is_read)).toBe(true);
        expect(result.current.unreadCount).toBe(0);
    });

    test('deleteNotification should remove from list', async () => {
        apiClient.get
            .mockResolvedValueOnce({ data: mockNotifications })
            .mockResolvedValueOnce({ data: { count: 5 } });

        const { result } = renderHook(() => useNotifications(mockToken, true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.deleteNotification(1);
        });

        expect(apiClient.delete).toHaveBeenCalledWith(`${API_ENDPOINTS.ADMIN}/notifications/1`);

        expect(result.current.notifications.find(n => n.id === 1)).toBeUndefined();
    });
});
