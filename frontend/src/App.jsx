import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import Grid from './components/Grid';
import WordList from './components/WordList';
import CategorySelector from './components/CategorySelector';
import ExportButton from './components/ExportButton';
import confetti from 'canvas-confetti';
import AdminPanel from './components/AdminPanel';

export default function App() {
    const [categories, setCategories] = useState([]);
    const [ignoredCategories, setIgnoredCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [grid, setGrid] = useState([]);
    const [words, setWords] = useState([]);
    const [found, setFound] = useState([]);
    const [difficulty, setDifficulty] = useState('easy');

    useEffect(() => {
        axios.get('/api/ignored_categories').then(res => {
            setIgnoredCategories(res.data);
        });
        axios.get('/api/categories').then(res => {
            setCategories(res.data);
            if (res.data.length > 0) setSelectedCategory(res.data[0]);
        });
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            loadPuzzle(selectedCategory, difficulty);
        }
        // eslint-disable-next-line
    }, [selectedCategory, difficulty]);

    const loadPuzzle = (category, diff = difficulty) => {
        setSelectedCategory(category);
        axios.get(`/api/words?category=${category}&difficulty=${diff}`).then(res => {
            setGrid(res.data.grid);
            setWords(res.data.words);
            setFound([]);
        });
    };

    const markFound = (word) => {
        if (!found.includes(word)) {
            setFound([...found, word]);
            confetti();
        }
    };

    const allFound = words.length > 0 && found.length === words.length;

    const visibleCategories = categories.filter(cat => !ignoredCategories.includes(cat));

    return (
        <div
            style={{
                padding: '1rem',
                fontFamily: 'sans-serif',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100vw',
                boxSizing: 'border-box'
            }}
        >
            <Link to="/admin" style={{ position: 'absolute', top: 20, right: 40 }}>Admin</Link>
            <Routes>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/" element={
                    <>
                        <h1>Osmosmjerka Word Search Game</h1>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                            <CategorySelector
                                categories={visibleCategories}
                                selected={selectedCategory}
                                onSelect={cat => setSelectedCategory(cat)}
                            />
                            <button
                                className="scrabble-btn"
                                style={{ marginLeft: 12, padding: '0.3rem 0.8rem' }}
                                onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                title="Reload puzzle"
                            >
                                🔄
                            </button>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
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
                        {allFound && (
                            <div style={{ margin: '1rem 0', fontWeight: 'bold', color: 'green' }}>
                                All words found!
                                <button
                                    className="scrabble-btn"
                                    style={{ marginLeft: '1rem' }}
                                    onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                >
                                    Load new puzzle
                                </button>
                            </div>
                        )}
                        <div
                            className="main-flex"
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                                width: '100%',
                                maxWidth: 1200,
                                margin: '0 auto'
                            }}
                        >
                            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', width: 'min-content', minWidth: 0 }}>
                                <Grid grid={grid} words={words} found={found} onFound={markFound} />
                            </div>
                            <div className="word-list-wrapper" style={{ marginLeft: '3rem', minWidth: 220 }}>
                                <WordList words={words} found={found} />
                            </div>
                        </div>
                        <ExportButton category={selectedCategory} grid={grid} words={words} />
                    </>
                } />
            </Routes>
        </div>
    );
}
