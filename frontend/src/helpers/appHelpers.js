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
export function loadPuzzle(category, diff, setters) {
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
                if (setNotEnoughWordsMsg) setNotEnoughWordsMsg(res.data.detail || "Not enough words in the selected category.");
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
            // Only handle true network/server errors here
            if (setNotEnoughWords) setNotEnoughWords(true);
            let msg = "Error loading puzzle.";
            if (err.response && err.response.data && err.response.data.detail) {
                msg = err.response.data.detail;
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