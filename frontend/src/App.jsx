import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import Grid from './components/Grid';
import WordList from './components/WordList';
import CategorySelector from './components/CategorySelector';
import UploadForm from './components/UploadForm';
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

    useEffect(() => {
        axios.get('/api/ignored_categories').then(res => {
            setIgnoredCategories(res.data);
        });
        axios.get('/api/categories').then(res => {
            setCategories(res.data);
            if (res.data.length > 0) loadPuzzle(res.data[0]);
        });
    }, []);

    const loadPuzzle = (categories) => {
        setSelectedCategory(categories);
        axios.get(`/api/words?categories=${categories}`).then(res => {
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
        <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
            <Link to="/admin" style={{ float: 'right', marginBottom: '1rem' }}>Admin</Link>
            <Routes>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/" element={
                    <>
                        <h1>Osmosmjerka Word Search Game</h1>
                        <CategorySelector
                            categories={visibleCategories}
                            selected={selectedCategory}
                            onSelect={loadPuzzle}
                        />
                        {allFound && (
                            <div style={{ margin: '1rem 0', fontWeight: 'bold', color: 'green' }}>
                                All words found!
                                <button style={{ marginLeft: '1rem' }} onClick={() => loadPuzzle(selectedCategory)}>
                                    Load new puzzle
                                </button>
                            </div>
                        )}
                        <Grid grid={grid} words={words} found={found} onFound={markFound} />
                        <WordList words={words} found={found} />
                        <UploadForm onUpload={() => loadPuzzle(selectedCategory)} />
                        <ExportButton category={selectedCategory} grid={grid} words={words} />
                    </>
                } />
            </Routes>
        </div>
    );
}
