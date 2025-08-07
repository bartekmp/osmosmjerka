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
        setRestored
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
                setRestored(true);
                return;
            }
        } catch { }
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
export function loadPuzzle(category, diff, setters, t, languageSetId = null) {
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

    // Build API URL with language set parameter if provided
    let apiUrl = `/api/phrases?category=${category}&difficulty=${diff}`;
    if (languageSetId) {
        apiUrl += `&language_set_id=${languageSetId}`;
    }

    return axios.get(apiUrl)
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
        });
}