import axios from 'axios';
import { STORAGE_KEYS } from '../shared/constants/constants';

// Restore state from localStorage
export function restoreGameState(setters) {
    const {
        setGrid,
        setPhrases,
        setFound,
        setSelectedCategory,
        setDifficulty,
        setHidePhrases,
        setShowTranslations,
        setRestored,
        setGameStartTime,
        setCurrentElapsedTime,
        setGridStatus,
        setIsPaused
    } = setters;

    const saved = localStorage.getItem('osmosmjerkaGameState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            const savedAllFound = typeof state.allFound === "boolean"
                ? state.allFound
                : (Array.isArray(state.phrases) && Array.isArray(state.found) && state.phrases.length > 0 && state.found.length === state.phrases.length);

            if (
                Array.isArray(state.phrases) &&
                Array.isArray(state.found) &&
                state.phrases.length > 0 &&
                !savedAllFound
            ) {
                setGrid(state.grid || []);
                setPhrases(state.phrases || []);
                setFound(state.found || []);
                setSelectedCategory(state.selectedCategory || '');
                setDifficulty(state.difficulty || 'easy');
                setHidePhrases(state.hidePhrases ?? false);
                setShowTranslations(!!state.showTranslations);
                if (setIsPaused) {
                    setIsPaused(!!state.isPaused);
                }

                // Restore timer state if available
                if (state.elapsedTimeSeconds !== undefined) {
                    if (setCurrentElapsedTime) {
                        setCurrentElapsedTime(state.elapsedTimeSeconds);
                    }
                    if (setGameStartTime) {
                        // Set a start time that would result in the saved elapsed time
                        const now = Date.now();
                        const adjustedStartTime = now - (state.elapsedTimeSeconds * 1000);
                        setGameStartTime(adjustedStartTime);
                    }
                }

                if (setGridStatus) {
                    setGridStatus('success');
                }
                setRestored(true);
                return;
            }
        } catch (error) {
            // Ignore JSON parsing errors
            console.warn('Failed to parse stored game state:', error);
        }
        localStorage.removeItem('osmosmjerkaGameState');
    }
    setRestored(true);
}

// Save state to localStorage
export function saveGameState(state) {
    // Save the current game state including language set
    const gameState = { ...state };
    if (gameState.selectedLanguageSetId) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, gameState.selectedLanguageSetId.toString());
    }
    localStorage.setItem('osmosmjerkaGameState', JSON.stringify(gameState));
}

// Load puzzle from API
export function loadPuzzle(category, diff, setters, t, languageSetId = null, refresh = false, privateListId = null) {
    const {
        setSelectedCategory,
        setGrid,
        setPhrases,
        setFound,
        setHidePhrases,
        setShowTranslations,
        setNotEnoughPhrases,
        setNotEnoughPhrasesMsg
    } = setters;
    setSelectedCategory(category);
    if (setNotEnoughPhrases) setNotEnoughPhrases(false);
    if (setNotEnoughPhrasesMsg) setNotEnoughPhrasesMsg("");

    // Build API URL - use private list endpoint if privateListId is provided
    let apiUrl;
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

    if (privateListId) {
        // Use private list endpoint (requires authentication)
        apiUrl = `/api/user/private-lists/${privateListId}/phrases?language_set_id=${languageSetId}&difficulty=${diff}`;
        // "ALL" means no category filter - don't include category parameter
        if (category && category !== "ALL") {
            apiUrl += `&category=${category}`;
        }
        if (refresh) {
            apiUrl += `&refresh=true`;
        }
    } else {
        // Use public phrases endpoint
        apiUrl = `/api/phrases?difficulty=${diff}`;
        // "ALL" means no category filter - don't include category parameter
        if (category && category !== "ALL") {
            apiUrl += `&category=${category}`;
        }
        if (languageSetId) {
            apiUrl += `&language_set_id=${languageSetId}`;
        }
        if (refresh) {
            apiUrl += `&refresh=true`;
        }
    }

    // Prepare request config with auth header if using private list
    const requestConfig = {};
    if (privateListId && token) {
        requestConfig.headers = {
            Authorization: `Bearer ${token}`
        };
    }

    return axios.get(apiUrl, requestConfig)
        .then(res => {
            if (res.data.error_code === "NOT_ENOUGH_PHRASES") {
                if (setNotEnoughPhrases) setNotEnoughPhrases(true);
                if (setNotEnoughPhrasesMsg) setNotEnoughPhrasesMsg(res.data.detail || (t ? t('not_enough_phrases') : "Not enough phrases in the selected category."));
                setGrid(Array.from({ length: 10 }, () => Array(10).fill("")));
                setPhrases([]);
                setFound([]);
                setHidePhrases(true);
                setShowTranslations(false);
            } else {
                setGrid(res.data.grid);
                setPhrases(res.data.phrases);
                setFound([]);
                setHidePhrases(true);
                setShowTranslations(false);
            }
            localStorage.removeItem('osmosmjerkaGameState');
            return { status: 'success', data: res.data };
        })
        .catch(err => {
            // Handle server errors with structured response
            if (setNotEnoughPhrases) setNotEnoughPhrases(true);
            let msg = t ? t('error_loading_puzzle') : "Error loading puzzle.";

            if (err.response && err.response.data) {
                const errorData = err.response.data;
                // Check for structured not enough phrases error
                if (errorData.category && errorData.available !== undefined && errorData.needed !== undefined) {
                    msg = t ? t('not_enough_phrases_detailed', {
                        category: errorData.category,
                        available: errorData.available,
                        needed: errorData.needed
                    }) : `Not enough phrases in category '${errorData.category}'. Need ${errorData.needed}, but only ${errorData.available} available.`;
                } else if (errorData.detail) {
                    msg = errorData.detail;
                } else if (errorData.error) {
                    msg = errorData.error;
                }
            }

            if (setNotEnoughPhrasesMsg) setNotEnoughPhrasesMsg(msg);
            setGrid(Array.from({ length: 10 }, () => Array(10).fill("")));
            setPhrases([]);
            setFound([]);
            setHidePhrases(true);
            setShowTranslations(false);
            return { status: 'error', error: err };
        });
}