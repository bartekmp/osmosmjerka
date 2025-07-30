import axios from 'axios';

// Restore state from localStorage
export function restoreGameState(setters) {
    const {
        setGrid,
        setWords,
        setFound,
        setSelectedCategory,
        setDifficulty,
        setHideWords,
        setShowTranslations,
        setRestored
    } = setters;

    const saved = localStorage.getItem('osmosmjerkaGameState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            const savedAllFound = typeof state.allFound === "boolean"
                ? state.allFound
                : (Array.isArray(state.words) && Array.isArray(state.found) && state.words.length > 0 && state.found.length === state.words.length);

            if (
                Array.isArray(state.words) &&
                Array.isArray(state.found) &&
                state.words.length > 0 &&
                !savedAllFound
            ) {
                setGrid(state.grid || []);
                setWords(state.words || []);
                setFound(state.found || []);
                setSelectedCategory(state.selectedCategory || '');
                setDifficulty(state.difficulty || 'easy');
                setHideWords(state.hideWords ?? false);
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
    localStorage.setItem('osmosmjerkaGameState', JSON.stringify(state));
}

// Load puzzle from API
export function loadPuzzle(category, diff, setters, t) {
    const {
        setSelectedCategory,
        setGrid,
        setWords,
        setFound,
        setHideWords,
        setShowTranslations,
        setNotEnoughWords,
        setNotEnoughWordsMsg
    } = setters;
    setSelectedCategory(category);
    if (setNotEnoughWords) setNotEnoughWords(false);
    if (setNotEnoughWordsMsg) setNotEnoughWordsMsg("");
    
    return axios.get(`/api/words?category=${category}&difficulty=${diff}`)
        .then(res => {
            if (res.data.error_code === "NOT_ENOUGH_WORDS") {
                if (setNotEnoughWords) setNotEnoughWords(true);
                if (setNotEnoughWordsMsg) setNotEnoughWordsMsg(res.data.detail || (t ? t('not_enough_words') : "Not enough words in the selected category."));
                setGrid(Array.from({ length: 10 }, () => Array(10).fill("")));
                setWords([]);
                setFound([]);
                setHideWords(true);
                setShowTranslations(false);
            } else {
                setGrid(res.data.grid);
                setWords(res.data.words);
                setFound([]);
                setHideWords(true);
                setShowTranslations(false);
            }
            localStorage.removeItem('osmosmjerkaGameState');
        })
        .catch(err => {
            // Handle server errors with structured response
            if (setNotEnoughWords) setNotEnoughWords(true);
            let msg = t ? t('error_loading_puzzle') : "Error loading puzzle.";
            
            if (err.response && err.response.data) {
                const errorData = err.response.data;
                // Check for structured not enough words error
                if (errorData.category && errorData.available !== undefined && errorData.needed !== undefined) {
                    msg = t ? t('not_enough_words_detailed', {
                        category: errorData.category,
                        available: errorData.available,
                        needed: errorData.needed
                    }) : `Not enough words in category '${errorData.category}'. Need ${errorData.needed}, but only ${errorData.available} available.`;
                } else if (errorData.detail) {
                    msg = errorData.detail;
                } else if (errorData.error) {
                    msg = errorData.error;
                }
            }
            
            if (setNotEnoughWordsMsg) setNotEnoughWordsMsg(msg);
            setGrid(Array.from({ length: 10 }, () => Array(10).fill("")));
            setWords([]);
            setFound([]);
            setHideWords(true);
            setShowTranslations(false);
            throw err; // Re-throw to handle loading state
        });
}