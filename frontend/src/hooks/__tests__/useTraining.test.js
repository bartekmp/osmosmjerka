import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import { useTraining } from '../useTraining';
import { STORAGE_KEYS } from '../../shared/constants/constants';

jest.mock('axios');

describe('useTraining', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        axios.post.mockResolvedValue({ data: {} });
    });

    test('defaults training mode on', () => {
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        expect(result.current.trainingMode).toBe(true);
    });

    test('opting out persists to localStorage and clears the queue', () => {
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        act(() => result.current.enqueueForRating({ id: 5, phrase: 'x' }));
        expect(result.current.pendingCount).toBe(1);

        act(() => result.current.setTrainingMode(false));
        expect(result.current.trainingMode).toBe(false);
        expect(localStorage.getItem('osmosmjerkaTrainingMode')).toBe('false');
        expect(result.current.pendingCount).toBe(0);
    });

    test('reads a persisted opt-out on init', () => {
        localStorage.setItem('osmosmjerkaTrainingMode', 'false');
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        expect(result.current.trainingMode).toBe(false);
    });

    test('enqueues items and exposes the first as currentRating', () => {
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        act(() => {
            result.current.enqueueForRating({ id: 10, phrase: 'kruh', translation: 'chleb' });
            result.current.enqueueForRating({ id: 11, phrase: 'voda', translation: 'woda' });
        });
        expect(result.current.currentRating).toEqual({ id: 10, phrase: 'kruh', translation: 'chleb' });
        expect(result.current.pendingCount).toBe(2);
    });

    test('does not enqueue duplicates or items without id', () => {
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        act(() => {
            result.current.enqueueForRating({ id: 10, phrase: 'a' });
            result.current.enqueueForRating({ id: 10, phrase: 'a' });
            result.current.enqueueForRating({ phrase: 'noid' });
        });
        expect(result.current.pendingCount).toBe(1);
    });

    test('submitRating posts a review with recognition direction for word search and advances the queue', () => {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok');
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 3, gameType: 'word_search' }));
        act(() => result.current.enqueueForRating({ id: 10, phrase: 'kruh', translation: 'chleb' }));
        act(() => result.current.submitRating('good'));

        expect(axios.post).toHaveBeenCalledTimes(1);
        const [url, body] = axios.post.mock.calls[0];
        expect(url).toContain('/learn/review');
        expect(body).toMatchObject({ language_set_id: 3, direction: 'recognition', grade: 'good', phrase_id: 10 });
        expect(result.current.currentRating).toBeNull();
    });

    test('submitRating uses production direction for crossword', () => {
        localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'tok');
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'crossword' }));
        act(() => result.current.enqueueForRating({ id: 5, phrase: 'x', translation: 'y' }));
        act(() => result.current.submitRating('easy'));
        expect(axios.post.mock.calls[0][1].direction).toBe('production');
    });

    test('submitRating does not post when no auth token', () => {
        const { result } = renderHook(() => useTraining({ selectedLanguageSetId: 1, gameType: 'word_search' }));
        act(() => result.current.enqueueForRating({ id: 5, phrase: 'x' }));
        act(() => result.current.submitRating('again'));
        expect(axios.post).not.toHaveBeenCalled();
        expect(result.current.currentRating).toBeNull(); // still advances the queue
    });
});
