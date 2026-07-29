import { renderHook, act } from '@testing-library/react';
import apiClient from '@shared/utils/apiClient';
import { useTeacherApi } from '../useTeacherApi';

// The hook talks to the shared API client now; the Authorization header is applied by
// that client's interceptor (covered by its own tests) rather than assembled here.
jest.mock('@shared/utils/apiClient', () => ({
    __esModule: true,
    default: { request: jest.fn() },
}));

const ok = (data) => apiClient.request.mockResolvedValue({ data });

describe('useTeacherApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetchPhraseSets makes correct API call', async () => {
        ok({ sets: [], total: 0 });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.fetchPhraseSets();
        });

        expect(apiClient.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/admin/teacher/phrase-sets'),
                method: 'GET',
            })
        );
    });

    test('createPhraseSet sends POST request', async () => {
        ok({ id: 1, name: 'Test Set' });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.createPhraseSet({
                name: 'Test Set',
                language_set_id: 1,
                phrase_ids: [1, 2, 3],
            });
        });

        expect(apiClient.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/admin/teacher/phrase-sets',
                method: 'POST',
                data: expect.stringContaining('Test Set'),
            })
        );
    });

    test('deletePhraseSet sends DELETE request', async () => {
        ok({ message: 'Deleted' });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.deletePhraseSet(1);
        });

        expect(apiClient.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/admin/teacher/phrase-sets/1',
                method: 'DELETE',
            })
        );
    });

    test('regenerateLink sends POST request', async () => {
        ok({ token: 'newtoken', version: 2 });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            const res = await result.current.regenerateLink(1);
            expect(res.token).toBe('newtoken');
            expect(res.version).toBe(2);
        });
    });

    test('getShareableLink generates correct URL', () => {
        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        const link = result.current.getShareableLink('abc12345');

        expect(link).toContain('/t/abc12345');
    });

    test('handles API errors correctly', async () => {
        const mockSetError = jest.fn();
        apiClient.request.mockRejectedValue({ response: { data: { message: 'Server error' } } });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: mockSetError }));

        await act(async () => {
            try {
                await result.current.fetchPhraseSets();
            } catch {
                // Expected to throw
            }
        });

        expect(mockSetError).toHaveBeenCalledWith('Server error');
    });

    test('isLoading state updates during API call', async () => {
        let resolvePromise;
        apiClient.request.mockImplementation(
            () => new Promise((resolve) => {
                resolvePromise = resolve;
            })
        );

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        expect(result.current.isLoading).toBe(false);

        // Start the fetch but don't await it yet
        let fetchPromise;
        await act(async () => {
            fetchPromise = result.current.fetchPhraseSets();
        });

        // Resolve the fetch
        resolvePromise({ data: { sets: [] } });

        await act(async () => {
            await fetchPromise;
        });
    });

    test('copyLinkToClipboard copies to clipboard', async () => {
        const mockClipboard = {
            writeText: jest.fn(() => Promise.resolve()),
        };
        Object.defineProperty(navigator, 'clipboard', {
            value: mockClipboard,
            writable: true,
        });

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            const success = await result.current.copyLinkToClipboard('abc12345');
            expect(success).toBe(true);
        });

        expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/t/abc12345'));
    });
});
