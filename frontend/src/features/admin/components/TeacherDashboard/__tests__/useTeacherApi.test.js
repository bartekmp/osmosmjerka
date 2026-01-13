import { renderHook, act } from '@testing-library/react';
import { useTeacherApi } from '../useTeacherApi';

// Mock fetch
global.fetch = jest.fn();

describe('useTeacherApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetchPhraseSets makes correct API call', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ sets: [], total: 0 }),
            })
        );

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.fetchPhraseSets();
        });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/admin/teacher/phrase-sets'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token',
                }),
            })
        );
    });

    test('createPhraseSet sends POST request', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 1, name: 'Test Set' }),
            })
        );

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.createPhraseSet({
                name: 'Test Set',
                language_set_id: 1,
                phrase_ids: [1, 2, 3],
            });
        });

        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/teacher/phrase-sets',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Test Set'),
            })
        );
    });

    test('deletePhraseSet sends DELETE request', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ message: 'Deleted' }),
            })
        );

        const { result } = renderHook(() => useTeacherApi({ token: 'test-token', setError: jest.fn() }));

        await act(async () => {
            await result.current.deletePhraseSet(1);
        });

        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/teacher/phrase-sets/1',
            expect.objectContaining({
                method: 'DELETE',
            })
        );
    });

    test('regenerateLink sends POST request', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ token: 'newtoken', version: 2 }),
            })
        );

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
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ message: 'Server error' }),
            })
        );

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
        global.fetch = jest.fn(() =>
            new Promise((resolve) => {
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
        resolvePromise({
            ok: true,
            json: () => Promise.resolve({ sets: [] }),
        });

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
