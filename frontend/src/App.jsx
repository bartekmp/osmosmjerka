import axios from 'axios';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import AdminPanel from './components/AdminPanel';
import CategorySelector from './components/CategorySelector';
import ExportButton from './components/ExportButton';
import Grid from './components/Grid';
import WordList from './components/WordList';
import './style.css';

export default function App() {
    const [categories, setCategories] = useState([]);
    const [ignoredCategories, setIgnoredCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [grid, setGrid] = useState([]);
    const [words, setWords] = useState([]);
    const [found, setFound] = useState([]);
    const [difficulty, setDifficulty] = useState('easy');
    const [hideWords, setHideWords] = useState(false);
    const [restored, setRestored] = useState(false);

    // Winning condition: all words found
    const allFound = words.length > 0 && found.length === words.length;

    // Restore state from localStorage on mount, but only if not already won
    useEffect(() => {
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
                    setRestored(true); // Mark as restored
                    return;
                }
            } catch {}
            localStorage.removeItem('osmosmjerkaGameState');
        }
        setRestored(true); // Even if nothing to restore, mark as done
    }, []);

    useEffect(() => {
        axios.get('/api/ignored_categories').then(res => {
            setIgnoredCategories(res.data);
        });
        axios.get('/api/categories').then(res => {
            setCategories(res.data);
            // Only pick a random category if not restored from localStorage
            if (res.data.length > 0 && !selectedCategory && restored && grid.length === 0) {
                const randomIndex = Math.floor(Math.random() * res.data.length);
                setSelectedCategory(res.data[randomIndex]);
            }
        });
        // eslint-disable-next-line
    }, [restored]);

    // Save state to localStorage on change
    useEffect(() => {
        const state = {
            grid,
            words,
            found,
            selectedCategory,
            difficulty,
            hideWords,
            allFound,
        };
        localStorage.setItem('osmosmjerkaGameState', JSON.stringify(state));
    }, [grid, words, found, selectedCategory, difficulty, hideWords, allFound]);

    useEffect(() => {
        if (!restored) return; // Wait until restoration is done
        if (selectedCategory && grid.length === 0) {
            loadPuzzle(selectedCategory, difficulty);
        }
        // eslint-disable-next-line
    }, [restored, selectedCategory, difficulty]);

    const loadPuzzle = (category, diff = difficulty) => {
        setSelectedCategory(category);
        axios.get(`/api/words?category=${category}&difficulty=${diff}`).then(res => {
            setGrid(res.data.grid);
            setWords(res.data.words);
            setFound([]);
            setHideWords(true); // Hide words after loading a new puzzle
            // Clear saved state when starting a new puzzle
            localStorage.removeItem('osmosmjerkaGameState');
        });
    };

    const markFound = (word) => {
        if (!found.includes(word)) {
            setFound([...found, word]);
            confetti();
        }
    };

    // Automatically reveal words when all are found
    useEffect(() => {
        if (allFound) setHideWords(false);
    }, [allFound]);

    const visibleCategories = categories.filter(cat => !ignoredCategories.includes(cat));

    return (
        <div className="osmo-app-root">
            <Link to="/admin" style={{ position: 'absolute', top: 20, right: 40 }}>Admin</Link>
            <Routes>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/" element={
                    <>
                        <div className="osmo-header-bar">
                            <img
                                src="/static/android-chrome-512x512.png"
                                alt="Osmosmjerka logo"
                                className="osmo-logo-img"
                                onError={e => { e.target.onerror = null; e.target.src = "/static/favicon-32x32.png"; }}
                            />
                            <span className="osmo-logo-title">
                                Osmosmjerka
                            </span>
                        </div>
                        <div className="osmo-category-row">
                            <CategorySelector
                                categories={visibleCategories}
                                selected={selectedCategory}
                                onSelect={cat => setSelectedCategory(cat)}
                            />
                            <button
                                className="scrabble-btn osmo-reload-btn"
                                onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                title="Reload puzzle"
                            >
                                🔄
                            </button>
                        </div>
                        <div className="osmo-difficulty-row">
                            <label>
                                Difficulty:&nbsp;
                                <select
                                    value={difficulty}
                                    onChange={e => setDifficulty(e.target.value)}
                                >
                                    <option value="easy">Easy (10x10)</option>
                                    <option value="medium">Medium (15x15)</option>
                                    <option value="hard">Hard (20x20)</option>
                                    <option value="dynamic">Dynamic (longest word)</option>
                                </select>
                            </label>
                        </div>
                        <div className="osmo-allfound-row">
                            {allFound ? (
                                <div className="osmo-allfound-inner">
                                    All words found!
                                    <button
                                        className="scrabble-btn osmo-reload-btn"
                                        onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                    >
                                        Load new puzzle
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        <div className="main-flex">
                            <div className="osmo-grid-wrapper">
                                <Grid grid={grid} words={words} found={found} onFound={markFound} />
                            </div>
                            <div className="word-list-wrapper">
                                <WordList
                                    words={words}
                                    found={found}
                                    hideWords={hideWords}
                                    setHideWords={setHideWords}
                                    allFound={allFound}
                                />
                            </div>
                        </div>
                        <ExportButton category={selectedCategory} grid={grid} words={words} />
                    </>
                } />
            </Routes>
        </div>
    );
}
