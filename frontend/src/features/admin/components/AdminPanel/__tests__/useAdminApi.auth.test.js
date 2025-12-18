import { renderHook, waitFor } from '@testing-library/react';
import { useAdminApi } from '../useAdminApi';

// Mock fetch
global.fetch = jest.fn();

// Mock useDebouncedApiCall
jest.mock('../../../../../hooks/useDebounce', () => ({
    useDebouncedApiCall: jest.fn((apiCall, delay, options) => {
        const debouncedCall = async (...args) => {
            try {
                const result = await apiCall(...args);
                if (options.onSuccess) {
                    options.onSuccess(result);
                }
                return result;
            } catch (err) {
                if (options.onError) {
                    options.onError(err);
                }
                // Don't re-throw - let onError handle it
            }
        };
        return {
            call: debouncedCall,
            isLoading: false,
            showRateLimit: false
        };
    })
}));

describe('useAdminApi Authentication Error Handling', () => {
    let mockSetToken;
    let mockSetIsLogged;
    let mockSetDashboard;
    let mockSetError;
    let mockSetRows;
    let mockSetTotalRows;

    beforeEach(() => {
        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(() => 'test-token'),
                setItem: jest.fn(),
                removeItem: jest.fn()
            },
            writable: true
        });

        // Mock setters
        mockSetToken = jest.fn();
        mockSetIsLogged = jest.fn();
        mockSetDashboard = jest.fn();
        mockSetError = jest.fn();
        mockSetRows = jest.fn();
        mockSetTotalRows = jest.fn();

        jest.clearAllMocks();
    });

    afterEach(() => {
        // Cleanup is handled automatically by testing-library for renderHook
    });

    describe('handleAuthError in fetchRows', () => {
        test('should logout on 401 error', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            // Call fetchRows which should trigger the API call
            result.current.fetchRows(0, 20, '', '', 1);

            // Wait for the error to be handled
            await waitFor(() => {
                expect(mockSetToken).toHaveBeenCalledWith('');
            });

            // Should logout and redirect
            expect(localStorage.removeItem).toHaveBeenCalledWith('adminToken');
            expect(mockSetIsLogged).toHaveBeenCalledWith(false);
            expect(mockSetDashboard).toHaveBeenCalledWith(true);
            expect(mockSetError).toHaveBeenCalledWith('Session expired, please log in again.');
        });

        test('should logout on 400 error', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Bad Request' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            result.current.fetchRows(0, 20, '', '', 1);

            // Wait for the error to be handled
            await waitFor(() => {
                expect(mockSetToken).toHaveBeenCalledWith('');
            });

            // Should logout and redirect
            expect(localStorage.removeItem).toHaveBeenCalledWith('adminToken');
            expect(mockSetIsLogged).toHaveBeenCalledWith(false);
            expect(mockSetDashboard).toHaveBeenCalledWith(true);
            expect(mockSetError).toHaveBeenCalledWith('Session expired, please log in again.');
        });

        test('should not logout on 429 (rate limit) error', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: 'Too many requests' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            result.current.fetchRows(0, 20, '', '', 1);

            // Wait a bit to ensure the call was processed
            await waitFor(() => {
                expect(mockSetError).toHaveBeenCalled();
            }, { timeout: 1000 });

            // Should NOT logout on rate limit
            expect(mockSetToken).not.toHaveBeenCalled();
            expect(mockSetIsLogged).not.toHaveBeenCalled();
            expect(mockSetError).toHaveBeenCalledWith('Too many requests. Please wait before trying again.');
        });
    });

    describe('handleAuthError in handleSave', () => {
        test('should logout on 401 error when saving', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            await expect(
                result.current.handleSave(
                    { phrase: 'test', translation: 'test', categories: 'test' },
                    jest.fn(),
                    jest.fn(),
                    1
                )
            ).rejects.toThrow('Session expired, please log in again.');

            // Should logout and redirect
            expect(mockSetToken).toHaveBeenCalledWith('');
            expect(localStorage.removeItem).toHaveBeenCalledWith('adminToken');
            expect(mockSetIsLogged).toHaveBeenCalledWith(false);
            expect(mockSetDashboard).toHaveBeenCalledWith(true);
        });
    });

    describe('handleAuthError in batch operations', () => {
        test('should logout on 401 error in batch delete', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Unauthorized' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            const batchResult = await result.current.handleBatchDelete([1, 2, 3], 1);

            // Should logout and redirect
            expect(mockSetToken).toHaveBeenCalledWith('');
            expect(localStorage.removeItem).toHaveBeenCalledWith('adminToken');
            expect(mockSetIsLogged).toHaveBeenCalledWith(false);
            expect(mockSetDashboard).toHaveBeenCalledWith(true);

            // Should return error result
            expect(batchResult.success).toBe(false);
            expect(batchResult.error).toContain('Session expired');
        });

        test('should logout on 400 error in batch add category', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Bad Request' })
            });

            const { result } = renderHook(() =>
                useAdminApi({
                    token: 'test-token',
                    setRows: mockSetRows,
                    setTotalRows: mockSetTotalRows,
                    setDashboard: mockSetDashboard,
                    setError: mockSetError,
                    setToken: mockSetToken,
                    setIsLogged: mockSetIsLogged
                })
            );

            const batchResult = await result.current.handleBatchAddCategory([1, 2], 'category', 1);

            // Should logout and redirect
            expect(mockSetToken).toHaveBeenCalledWith('');
            expect(localStorage.removeItem).toHaveBeenCalledWith('adminToken');
            expect(mockSetIsLogged).toHaveBeenCalledWith(false);
            expect(mockSetDashboard).toHaveBeenCalledWith(true);

            // Should return error result
            expect(batchResult.success).toBe(false);
            expect(batchResult.error).toContain('Session expired');
        });
    });
});


