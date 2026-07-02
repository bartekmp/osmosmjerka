import { renderHook, act, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useReviewSprint } from '../useReviewSprint';
import { STORAGE_KEYS } from '../../shared/constants/constants';

jest.mock('axios');

const dueItems = [
    { id: 1, phrase_id: 10, language_set_id: 1, direction: 'production', phrase: 'kruh', translation: 'chleb' },
    { id: 2, phrase_id: 11, language_set_id: 1, direction: 'recognition', phrase: 'voda', translation: 'woda' },
];

function mockGet(due = dueItems) {
    axios.get.mockImplementation((url) => {
        if (url.includes('/learn/due')) return Promise.resolve({ data: due });
        if (url.includes('/learn/stats')) return Promise.resolve({ data: { total: 5, due: 2, mastered: 1 } });
        return Promise.resolve({ data: {} });
    });
}

describe('useReviewSprint', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGet();
        axios.post.mockResolvedValue({ data: {} });
    });

    test('is unauthenticated without a token', async () => {
        const { result } = renderHook(() => useReviewSprint());
        await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('loads due items and activates', async () => {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok');
        const { result } = renderHook(() => useReviewSprint());
        await waitFor(() => expect(result.current.status).toBe('active'));
        expect(result.current.total).toBe(2);
        expect(result.current.current.phrase).toBe('kruh');
    });

    test('rating posts a review and advances, ending in done', async () => {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok');
        const { result } = renderHook(() => useReviewSprint());
        await waitFor(() => expect(result.current.status).toBe('active'));

        act(() => result.current.rate('good'));
        expect(result.current.current.phrase).toBe('voda');

        act(() => result.current.rate('easy'));
        await waitFor(() => expect(result.current.status).toBe('done'));
        expect(result.current.reviewedCount).toBe(2);

        const reviewPosts = axios.post.mock.calls.filter((c) => c[0].includes('/learn/review'));
        expect(reviewPosts).toHaveLength(2);
        expect(reviewPosts[0][1]).toMatchObject({ phrase_id: 10, direction: 'production', grade: 'good' });
        expect(reviewPosts[1][1]).toMatchObject({ phrase_id: 11, direction: 'recognition', grade: 'easy' });
    });

    test('shows empty state when nothing is due', async () => {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok');
        mockGet([]);
        const { result } = renderHook(() => useReviewSprint());
        await waitFor(() => expect(result.current.status).toBe('empty'));
    });
});
