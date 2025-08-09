import { Box, CircularProgress, Container, CssBaseline, ThemeProvider as MUIThemeProvider, Stack } from '@mui/material';
import axios from 'axios';
import confetti from 'canvas-confetti';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import {
    AdminControls,
    AllFoundMessage,
    GameControls,
    GameHeader,
    LoadingOverlay,
    PhraseList,
    ScrabbleGrid
} from './features';
import { NotEnoughPhrasesOverlay } from './shared';
import './style.css';
import createAppTheme from './theme';

// Import custom hooks
import useCelebration from './hooks/useCelebration';
import useGameDifficulties from './hooks/useGameDifficulties';
import useLogoColor from './hooks/useLogoColor';

import { loadPuzzle as loadPuzzleHelper, restoreGameState, saveGameState } from './helpers/appHelpers';
import { API_ENDPOINTS, STORAGE_KEYS } from './shared/constants/constants';

// Lazy load admin components
const AdminPanel = lazy(() => import('./features').then(module => ({ default: module.AdminPanel })));
const UserManagement = lazy(() => import('./features').then(module => ({ default: module.UserManagement })));
const UserProfile = lazy(() => import('./features').then(module => ({ default: module.UserProfile })));

function AppContent() {
    const { t } = useTranslation();
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const gridRef = useRef(null);
    const { isDarkMode } = useThemeMode();

    // Use custom hooks
    const { logoFilter, setLogoFilter, handleLogoClick } = useLogoColor();
    const { availableDifficulties } = useGameDifficulties();

    const [categories, setCategories] = useState([]);
    const [ignoredCategories, setIgnoredCategories] = useState([]);
    const [userIgnoredCategories, setUserIgnoredCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedLanguageSetId, setSelectedLanguageSetId] = useState(() => {
        // Load from localStorage or default to null
        const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
        return saved ? parseInt(saved) : null;
    });
    const [grid, setGrid] = useState([]);
    const [phrases, setPhrases] = useState([]);
    const [found, setFound] = useState([]);
    const [difficulty, setDifficulty] = useState('easy');
    const [hidePhrases, setHidePhrases] = useState(false);
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
    const [notEnoughPhrases, setNotEnoughPhrases] = useState(false);
    const [notEnoughPhrasesMsg, setNotEnoughPhrasesMsg] = useState("");
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);

    // Refs to prevent duplicate API calls in StrictMode
    const ignoredCategoriesFetchedRef = useRef(false);
    const lastFetchedLanguageSetIdRef = useRef(null);

    // Winning condition: all phrases found
    const allFound = phrases.length > 0 && found.length === phrases.length;

    // Use celebration hook
    const { showCelebration, resetCelebration, celebrationTriggeredRef } = useCelebration(allFound, setLogoFilter);

    // Memoized callback for language set changes to prevent unnecessary re-renders
    const handleLanguageSetChange = useCallback((languageSetId) => {
        setSelectedLanguageSetId(languageSetId);
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, languageSetId?.toString() || '');
        // Clear current game state when changing language set
        setGrid([]);
        setPhrases([]);
        setFound([]);
    }, []);

    // Apply theme data attribute to body
    useEffect(() => {
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Restore state from localStorage on mount, but only if not already won
    useEffect(() => {
        restoreGameState({
            setGrid,
            setPhrases,
            setFound,
            setSelectedCategory,
            setDifficulty,
            setHidePhrases,
            setShowTranslations,
            setRestored
        });
        // eslint-disable-next-line
    }, []);

    // Load ignored categories only once on mount (they're global)
    useEffect(() => {
        if (ignoredCategoriesFetchedRef.current) return;
        ignoredCategoriesFetchedRef.current = true;

        axios.get(API_ENDPOINTS.IGNORED_CATEGORIES).then(res => {
            setIgnoredCategories(res.data);
        }).catch(err => {
            console.error('Error loading ignored categories:', err);
            ignoredCategoriesFetchedRef.current = false; // Reset on error to allow retry
        });
    }, []);

    // Load user-specific ignored categories when language set changes
    useEffect(() => {
        if (!selectedLanguageSetId) return;
        const token = localStorage.getItem('adminToken'); // reuse admin token if logged in
        axios.get(`${API_ENDPOINTS.USER_IGNORED_CATEGORIES}?language_set_id=${selectedLanguageSetId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).then(res => setUserIgnoredCategories(res.data))
          .catch(() => setUserIgnoredCategories([]));
    }, [selectedLanguageSetId]);

    useEffect(() => {
        // Only run after game state restoration is complete
        if (!restored) return;

        // Prevent duplicate API calls for the same language set
        if (lastFetchedLanguageSetIdRef.current === selectedLanguageSetId) return;
        lastFetchedLanguageSetIdRef.current = selectedLanguageSetId;

        // Load categories with language set parameter
        let categoriesUrl = API_ENDPOINTS.CATEGORIES;
        if (selectedLanguageSetId) {
            categoriesUrl += `?language_set_id=${selectedLanguageSetId}`;
        }

        axios.get(categoriesUrl).then(res => {
            setCategories(res.data);
            // Automatically select a random category if none is selected and no game is loaded
            if (res.data.length > 0 && !selectedCategory && grid.length === 0) {
                const randomIndex = Math.floor(Math.random() * res.data.length);
                const randomCategory = res.data[randomIndex];
                setSelectedCategory(randomCategory);
                // Automatically load puzzle with the selected category
                loadPuzzle(randomCategory, difficulty);
            }
        }).catch(err => {
            console.error('Error loading categories:', err);
            lastFetchedLanguageSetIdRef.current = null; // Reset on error to allow retry
        });
        // eslint-disable-next-line
    }, [restored, selectedLanguageSetId]);

    // Save state to localStorage on change, including showTranslations and selectedLanguageSetId
    useEffect(() => {
        saveGameState({
            grid,
            phrases,
            found,
            selectedCategory,
            difficulty,
            hidePhrases,
            allFound,
            showTranslations,
            selectedLanguageSetId,
        });
    }, [grid, phrases, found, selectedCategory, difficulty, hidePhrases, allFound, showTranslations, selectedLanguageSetId]);

    useEffect(() => {
        if (!restored) return;
        if (selectedCategory && grid.length === 0) {
            loadPuzzle(selectedCategory, difficulty);
        }
        // eslint-disable-next-line
    }, [restored, selectedCategory, difficulty]);

    const loadPuzzle = (category, diff = difficulty) => {
        setIsGridLoading(true);
        resetCelebration(); // Reset celebration state using hook
        loadPuzzleHelper(category, diff, {
            setSelectedCategory,
            setGrid,
            setPhrases,
            setFound,
            setHidePhrases,
            setShowTranslations,
            setNotEnoughPhrases,
            setNotEnoughPhrasesMsg
        }, t, selectedLanguageSetId).finally(() => {
            setIsGridLoading(false);
        });
    };

    const markFound = (phrase) => {
        if (!found.includes(phrase)) {
            setFound([...found, phrase]);
            confetti();
        }
    };

    const handlePhraseClick = (phrase) => {
        if (gridRef.current) {
            gridRef.current.blinkPhrase(phrase);
        }
    };

    // Automatically reveal phrases when all are found
    useEffect(() => {
        if (allFound) setHidePhrases(false);
    }, [allFound]);

    const visibleCategories = categories.filter(cat => !ignoredCategories.includes(cat) && !userIgnoredCategories.includes(cat));

    // Auto-adjust difficulty if current one becomes unavailable
    React.useEffect(() => {
        const isCurrentDifficultyAvailable = availableDifficulties.some(d => d.value === difficulty);
        if (!isCurrentDifficultyAvailable && availableDifficulties.length > 0) {
            setDifficulty(availableDifficulties[0].value);
        }
    }, [availableDifficulties, difficulty]);

    return (
        <MUIThemeProvider theme={createAppTheme(isDarkMode)}>
            <CssBaseline />
            <Container maxWidth="xl" sx={{ minHeight: '100vh', py: 2, position: 'relative' }}>
                {/* Top controls row for admin routes only */}
                {isAdminRoute && <AdminControls />}

                <Routes>
                    <Route path="/admin" element={
                        <Suspense fallback={<CircularProgress />}>
                            <AdminPanel />
                        </Suspense>
                    } />
                    <Route path="/admin/users" element={
                        <Suspense fallback={<CircularProgress />}>
                            <UserManagement />
                        </Suspense>
                    } />
                    <Route path="/admin/profile" element={
                        <Suspense fallback={<CircularProgress />}>
                            <UserProfile />
                        </Suspense>
                    } />
                    <Route path="/" element={
                        <Stack spacing={3} alignItems="center">
                            {/* Use GameHeader component instead of duplicated header code */}
                            <GameHeader
                                logoFilter={logoFilter}
                                handleLogoClick={handleLogoClick}
                                showCelebration={showCelebration}
                                isDarkMode={isDarkMode}
                            />

                            <GameControls
                                panelOpen={panelOpen}
                                setPanelOpen={setPanelOpen}
                                visibleCategories={visibleCategories}
                                selectedCategory={selectedCategory}
                                setSelectedCategory={setSelectedCategory}
                                difficulty={difficulty}
                                setDifficulty={setDifficulty}
                                availableDifficulties={availableDifficulties}
                                loadPuzzle={loadPuzzle}
                                selectedCategoryState={selectedCategory}
                                difficultyState={difficulty}
                                grid={grid}
                                phrases={phrases}
                                isLoading={isGridLoading}
                                notEnoughPhrases={notEnoughPhrases}
                                selectedLanguageSetId={selectedLanguageSetId}
                                onLanguageSetChange={handleLanguageSetChange}
                            />

                            {/* All Found Message */}
                            <AllFoundMessage
                                allFound={allFound}
                                loadPuzzle={loadPuzzle}
                                selectedCategory={selectedCategory}
                                difficulty={difficulty}
                            />

                            {/* Main Game Area */}
                            <Box sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                alignItems: { xs: 'center', md: 'flex-start' },
                                width: '100%',
                                maxWidth: '100vw',
                                position: 'relative',
                                gap: { xs: 3, md: 6 },
                                justifyContent: 'center',
                                overflow: 'hidden', // Prevent horizontal overflow
                            }}>
                                <Box sx={{
                                    position: 'relative',
                                    flex: '0 0 auto',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    width: { xs: '100%', md: 'auto' },
                                    maxWidth: '100%',
                                }}>
                                    <ScrabbleGrid
                                        ref={gridRef}
                                        grid={grid}
                                        phrases={phrases}
                                        found={found}
                                        onFound={markFound}
                                        disabled={allFound}
                                        isDarkMode={isDarkMode}
                                        showCelebration={showCelebration}
                                    />

                                    <LoadingOverlay isLoading={isGridLoading} isDarkMode={isDarkMode} />

                                    <NotEnoughPhrasesOverlay
                                        show={notEnoughPhrases}
                                        message={notEnoughPhrasesMsg}
                                        isDarkMode={isDarkMode}
                                    />
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: 320 }, maxWidth: 400, alignSelf: { xs: 'flex-start', md: 'flex-start' }, position: { md: 'relative' }, left: { md: '0' }, top: { md: '0' } }}>
                                    <PhraseList
                                        phrases={phrases}
                                        found={found}
                                        hidePhrases={hidePhrases}
                                        setHidePhrases={setHidePhrases}
                                        allFound={allFound}
                                        showTranslations={showTranslations}
                                        setShowTranslations={setShowTranslations}
                                        disableShowPhrases={notEnoughPhrases}
                                        onPhraseClick={handlePhraseClick}
                                        t={t}
                                    />
                                </Box>
                            </Box>
                        </Stack>
                    } />
                </Routes>
            </Container>
        </MUIThemeProvider>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}
