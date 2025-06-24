import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Grid from './components/Grid';
import WordList from './components/WordList';
import CategorySelector from './components/CategorySelector';
import UploadForm from './components/UploadForm';
import ExportButton from './components/ExportButton';

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [grid, setGrid] = useState([]);
  const [words, setWords] = useState([]);
  const [found, setFound] = useState([]);

  useEffect(() => {
    axios.get('/api/categories').then(res => {
      setCategories(res.data);
      if (res.data.length > 0) loadPuzzle(res.data[0]);
    });
  }, []);

  const loadPuzzle = (category) => {
    setSelectedCategory(category);
    axios.get(`/api/words?category=${category}`).then(res => {
      setGrid(res.data.grid);
      setWords(res.data.words);
      setFound([]);
    });
  };

  const markFound = (word) => {
    if (!found.includes(word)) setFound([...found, word]);
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>Osmosmjerka Word Search Game</h1>
      <CategorySelector categories={categories} onSelect={loadPuzzle} />
      <Grid grid={grid} words={words} onFound={markFound} />
      <WordList words={words} found={found} />
      <UploadForm onUpload={() => loadPuzzle(selectedCategory)} />
      <ExportButton category={selectedCategory} grid={grid} words={words} />
    </div>
  );
}