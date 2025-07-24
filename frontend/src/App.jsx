import axios from 'axios';
import confetti from 'canvas-confetti';
import React, { useEffect, useState, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Button } from '@mui/material';
import { Container, Box, Typography, Stack, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';
import AdminPanel from './components/AdminPanel/AdminPanel';
import CategorySelector from './components/CategorySelector';
import ExportButton from './components/ExportButton';
import ScrabbleGrid from './components/Grid/Grid';
import WordList from './components/WordList';
import theme from './theme';
import './style.css';

import { loadPuzzle as loadPuzzleHelper, restoreGameState, saveGameState } from './helpers/appHelpers';

export default function App() {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const gridRef = useRef(null);
    const [categories, setCategories] = useState([]);
    const [ignoredCategories, setIgnoredCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [grid, setGrid] = useState([]);
    const [words, setWords] = useState([]);
    const [found, setFound] = useState([]);
    const [difficulty, setDifficulty] = useState('easy');
    const [hideWords, setHideWords] = useState(false);
    const [showTranslations, setShowTranslations] = useState(() => {
        const saved = localStorage.getItem('osmosmjerkaGameState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                return !!state.showTranslations;
            } catch { }
        }
        return false;
    });
    const [restored, setRestored] = useState(false);
    const [notEnoughWords, setNotEnoughWords] = useState(false);
    const [notEnoughWordsMsg, setNotEnoughWordsMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Winning condition: all words found
    const allFound = words.length > 0 && found.length === words.length;

    // Restore state from localStorage on mount, but only if not already won
    useEffect(() => {
        restoreGameState({
            setGrid,
            setWords,
            setFound,
            setSelectedCategory,
            setDifficulty,
            setHideWords,
            setShowTranslations,
            setRestored
        });
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        axios.get('/api/ignored_categories').then(res => {
            setIgnoredCategories(res.data);
        });
        axios.get('/api/categories').then(res => {
            setCategories(res.data);
            if (res.data.length > 0 && !selectedCategory && restored && grid.length === 0) {
                const randomIndex = Math.floor(Math.random() * res.data.length);
                setSelectedCategory(res.data[randomIndex]);
            }
        });
        // eslint-disable-next-line
    }, [restored]);

    // Save state to localStorage on change, including showTranslations
    useEffect(() => {
        saveGameState({
            grid,
            words,
            found,
            selectedCategory,
            difficulty,
            hideWords,
            allFound,
            showTranslations,
        });
    }, [grid, words, found, selectedCategory, difficulty, hideWords, allFound, showTranslations]);

    useEffect(() => {
        if (!restored) return;
        if (selectedCategory && grid.length === 0) {
            loadPuzzle(selectedCategory, difficulty);
        }
        // eslint-disable-next-line
    }, [restored, selectedCategory, difficulty]);

    const loadPuzzle = (category, diff = difficulty) => {
        setIsLoading(true);
        loadPuzzleHelper(category, diff, {
            setSelectedCategory,
            setGrid,
            setWords,
            setFound,
            setHideWords,
            setShowTranslations,
            setNotEnoughWords,
            setNotEnoughWordsMsg
        }).finally(() => {
            setIsLoading(false);
        });
    };

    const markFound = (word) => {
        if (!found.includes(word)) {
            setFound([...found, word]);
            confetti();
        }
    };

    const handleWordBlink = (word) => {
        if (gridRef.current) {
            gridRef.current.blinkWord(word);
        }
    };

    // Automatically reveal words when all are found
    useEffect(() => {
        if (allFound) setHideWords(false);
    }, [allFound]);

    const visibleCategories = categories.filter(cat => !ignoredCategories.includes(cat));

    // Calculate which difficulties are suitable for current screen size
    const getAvailableDifficulties = () => {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const maxGridSize = Math.min(screenWidth * 0.9, screenHeight * 0.6);
        
        const difficulties = [
            { value: 'easy', label: 'Easy (10x10)', gridSize: 10 },
            { value: 'medium', label: 'Medium (15x15)', gridSize: 15 },
            { value: 'hard', label: 'Hard (20x20)', gridSize: 20 },
            { value: 'dynamic', label: 'Dynamic (longest word)', gridSize: 15 } // Assume medium size for dynamic
        ];

        return difficulties.filter(diff => {
            // Calculate minimum space needed: grid size * (min cell size + spacing)
            const minSpaceNeeded = diff.gridSize * 25; // 20px min cell + 5px spacing
            return minSpaceNeeded <= maxGridSize;
        });
    };

    const [availableDifficulties, setAvailableDifficulties] = React.useState(getAvailableDifficulties());

    // Update available difficulties on window resize
    React.useEffect(() => {
        const handleResize = () => {
            setAvailableDifficulties(getAvailableDifficulties());
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-adjust difficulty if current one becomes unavailable
    React.useEffect(() => {
        const isCurrentDifficultyAvailable = availableDifficulties.some(d => d.value === difficulty);
        if (!isCurrentDifficultyAvailable && availableDifficulties.length > 0) {
            setDifficulty(availableDifficulties[0].value);
        }
    }, [availableDifficulties, difficulty]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth="xl" sx={{ minHeight: '100vh', py: 2, position: 'relative' }}>
                {/* Loading overlay */}
                {isLoading && (
                    <Box
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(3px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999
                        }}
                    >
                        <Box
                            sx={{
                                backgroundColor: 'white',
                                borderRadius: 2,
                                p: 3,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2
                            }}
                        >
                            <CircularProgress size={40} />
                            <Typography variant="body1">Loading puzzle...</Typography>
                        </Box>
                    </Box>
                )}
                {/* Admin Button - Top Right on Desktop, Hidden on Mobile and Admin Routes */}
                {!isAdminRoute && (
                    <Button
                        component={Link}
                        to="/admin"
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            zIndex: 1000,
                            display: { xs: 'none', md: 'block' }, // Hidden on mobile
                        }}
                    >
                        Admin
                    </Button>
                )}

                <Routes>
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/" element={
                        <Stack spacing={3} alignItems="center">
                            {/* Header */}
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexWrap: 'wrap',
                                gap: 2,
                                mt: 2
                            }}>
                                <Box
                                    component="img"
                                    src="/static/android-chrome-512x512.png"
                                    alt="Osmosmjerka logo"
                                    sx={{
                                        height: { xs: 40, sm: 48, md: 64 },
                                        width: { xs: 40, sm: 48, md: 64 },
                                    }}
                                    onError={e => { e.target.onerror = null; e.target.src = "/static/favicon-32x32.png"; }}
                                />
                                <Typography 
                                    variant="h1" 
                                    sx={{ 
                                        fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                                        textAlign: 'center'
                                    }}
                                >
                                    Osmosmjerka
                                </Typography>
                            </Box>

                            {/* Category, Difficulty, Refresh, and Export */}
                            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 2, width: '100%', maxWidth: 600 }}>
                                {/* Dropdowns container */}
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: { xs: '60%', sm: '70%' } }}>
                                    <CategorySelector
                                        categories={visibleCategories}
                                        selected={selectedCategory}
                                        onSelect={cat => setSelectedCategory(cat)}
                                    />
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Difficulty</InputLabel>
                                        <Select
                                            value={difficulty}
                                            label="Difficulty"
                                            onChange={e => setDifficulty(e.target.value)}
                                        >
                                            {availableDifficulties.map(diff => (
                                                <MenuItem key={diff.value} value={diff.value}>
                                                    {diff.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {availableDifficulties.length < 4 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                            Some difficulties hidden due to screen size
                                        </Typography>
                                    )}
                                </Box>
                                
                                {/* Buttons container */}
                                <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'row' }, alignItems: { xs: 'center', sm: 'flex-start' }, gap: { xs: 1, sm: 2 } }}>
                                    {/* Refresh button - spans height of dropdowns */}
                                    <Button
                                        onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                        title="Reload puzzle"
                                        sx={{
                                            height: { xs: 48, sm: 96 },
                                            minWidth: { xs: 48, sm: 56 },
                                            fontSize: { xs: '1.2rem', sm: '2rem' },
                                            px: { xs: 1, sm: 2 },
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <span>🔄</span>
                                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: '1rem', mt: 1 }}>
                                            Refresh
                                        </Box>
                                    </Button>
                                    
                                    {/* Export button - normal size on desktop, same as refresh on mobile */}
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        height: { xs: 48, sm: 96 }
                                    }}>
                                        <ExportButton 
                                            category={selectedCategory} 
                                            grid={grid} 
                                            words={words} 
                                            disabled={isLoading || grid.length === 0 || notEnoughWords}
                                        />
                                    </Box>
                                </Box>
                            </Box>

                            {/* All Found Message */}
                            {allFound && (
                                <Box sx={{ 
                                    textAlign: 'center', 
                                    color: 'success.main',
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem',
                                    minHeight: 80, // Reserve space for consistent layout
                                    display: 'flex',
                                    flexDirection: { xs: 'row', sm: 'row' },
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2
                                }}>
                                    <Typography variant="h6" color="success.main" sx={{ mb: 0 }}>
                                        🎉 All words found! 🎊
                                    </Typography>
                                    <Button
                                        onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            fontSize: { xs: '0.9rem', sm: '1rem' },
                                            py: { xs: 0.5, sm: 1 },
                                            px: { xs: 2, sm: 3 }
                                        }}
                                    >
                                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                            New game
                                        </Box>
                                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                            🎮
                                        </Box>
                                    </Button>
                                </Box>
                            )}

                            {/* Main Game Area */}
                            <Box sx={{ 
                                display: { xs: 'flex', md: 'block' },
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '100%',
                                maxWidth: '100vw',
                                position: 'relative'
                            }}>
                                {/* On mobile: stack vertically */}
                                <Box sx={{ 
                                    display: { xs: 'flex', md: 'none' },
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 3,
                                    width: '100%'
                                }}>
                                    <Box sx={{ position: 'relative' }}>
                                        <ScrabbleGrid ref={gridRef} grid={grid} words={words} found={found} onFound={markFound} />
                                        {notEnoughWords && (
                                            <Box sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                backdropFilter: 'blur(6px)',
                                                bgcolor: 'rgba(255,255,255,0.7)',
                                                zIndex: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Box sx={{
                                                    bgcolor: 'rgba(255,255,255,0.95)',
                                                    borderRadius: 3,
                                                    p: 3,
                                                    boxShadow: 2,
                                                    textAlign: 'center',
                                                    color: 'error.main',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {notEnoughWordsMsg || "Not enough words in the selected category to generate a puzzle."}
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                    <Box sx={{ width: '100%', maxWidth: 400, alignSelf: 'flex-start' }}>
                                        <WordList
                                            words={words}
                                            found={found}
                                            hideWords={hideWords}
                                            setHideWords={setHideWords}
                                            allFound={allFound}
                                            showTranslations={showTranslations}
                                            setShowTranslations={setShowTranslations}
                                            disableShowWords={notEnoughWords}
                                            onWordBlink={handleWordBlink}
                                        />
                                    </Box>
                                </Box>

                                {/* On desktop: side by side with centered grid */}
                                <Box sx={{ 
                                    display: { xs: 'none', md: 'flex' },
                                    justifyContent: 'center',
                                    alignItems: 'flex-start',
                                    width: '100%',
                                    minHeight: '60vh',
                                    position: 'relative'
                                }}>
                                    {/* Grid Container - centered */}
                                    <Box sx={{ 
                                        position: 'absolute',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        top: 0
                                    }}>
                                        <ScrabbleGrid ref={gridRef} grid={grid} words={words} found={found} onFound={markFound} />
                                        {notEnoughWords && (
                                            <Box sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                backdropFilter: 'blur(6px)',
                                                bgcolor: 'rgba(255,255,255,0.7)',
                                                zIndex: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Box sx={{
                                                    bgcolor: 'rgba(255,255,255,0.95)',
                                                    borderRadius: 3,
                                                    p: 3,
                                                    boxShadow: 2,
                                                    textAlign: 'center',
                                                    color: 'error.main',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {notEnoughWordsMsg || "Not enough words in the selected category to generate a puzzle."}
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Word List - positioned to the right with consistent spacing */}
                                    <Box sx={{ 
                                        position: 'absolute',
                                        left: 'calc(50% + 350px)', // Grid center + grid half-width + spacing
                                        top: 0,
                                        width: 320,
                                        '@media (max-width: 1400px)': {
                                            left: 'calc(50% + 300px)',
                                        },
                                        '@media (max-width: 1200px)': {
                                            left: 'calc(50% + 280px)',
                                            width: 280,
                                        }
                                    }}>
                                        <WordList
                                            words={words}
                                            found={found}
                                            hideWords={hideWords}
                                            setHideWords={setHideWords}
                                            allFound={allFound}
                                            showTranslations={showTranslations}
                                            setShowTranslations={setShowTranslations}
                                            disableShowWords={notEnoughWords}
                                            onWordBlink={handleWordBlink}
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </Stack>
                    } />
                </Routes>
            </Container>
        </ThemeProvider>
    );
}
