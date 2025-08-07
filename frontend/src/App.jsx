import axios from 'axios';
import confetti from 'canvas-confetti';
import React, { useEffect, useState, useRef, Suspense, lazy, useCallback } from 'react';
import { Route, Routes, useLocation, Link } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { Container, Stack, CircularProgress, FormControl, InputLabel, MenuItem, Select, Button } from '@mui/material';
import {
    ScrabbleGrid,
    PhraseList,
    GameHeader,
    GameControls,
    CategorySelector,
    ExportButton,
    LoadingOverlay,
    AllFoundMessage,
    AdminControls
} from './features';
import { LanguageSwitcher, NightModeButton, LanguageSetSelector } from './shared';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import createAppTheme from './theme';
import './style.css';
import './App.css';
import { useTranslation } from 'react-i18next';
import GameActionButton from './shared/components/ui/GameActionButton';

// Import custom hooks
import useLogoColor from './hooks/useLogoColor';
import useCelebration from './hooks/useCelebration';
import useGameDifficulties from './hooks/useGameDifficulties';

import { loadPuzzle as loadPuzzleHelper, restoreGameState, saveGameState } from './helpers/appHelpers';
import { STORAGE_KEYS, API_ENDPOINTS } from './shared/constants/constants';

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
        setSelected([]);
        setPhrases([]);
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

    const visibleCategories = categories.filter(cat => !ignoredCategories.includes(cat));

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
                {isAdminRoute && (
                    <>
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: { xs: 1, sm: 1, md: 1 }, // Uniform gaps matching main controls
                                minHeight: 48,
                            }}
                        >
                            <LanguageSwitcher
                                sx={{
                                    minWidth: { xs: 36, sm: 44, md: 48 },
                                    height: { xs: 36, sm: 44, md: 48 },
                                    minHeight: { xs: 36, sm: 44, md: 48 },
                                    fontSize: '1rem',
                                }}
                            />
                            <NightModeButton
                                sx={{
                                    minWidth: { xs: 36, sm: 44, md: 48 },
                                    height: { xs: 36, sm: 44, md: 48 },
                                    minHeight: { xs: 36, sm: 44, md: 48 },
                                    padding: { xs: 0.5, sm: 0.75, md: 1 },
                                }}
                            />
                        </Box>
                        {/* Add vertical spacing between controls row and content */}
                        <Box sx={{ height: { xs: 16, sm: 20 } }} />
                    </>
                )}

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

                            {/* Mobile menu toggle button */}
                            <Box sx={{
                                display: { xs: 'flex', sm: 'none' },
                                flexDirection: 'row',
                                alignItems: 'center',
                                width: '100%',
                                justifyContent: 'center',
                                mb: 1,
                            }}>
                                <Button
                                    onClick={() => setPanelOpen(!panelOpen)}
                                    sx={{
                                        minWidth: 0,
                                        width: 250,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 2,
                                        fontSize: '1.5rem',
                                        backgroundColor: panelOpen ? 'action.selected' : 'background.paper',
                                        '&:hover': {
                                            backgroundColor: panelOpen ? 'action.hover' : 'action.hover',
                                        }
                                    }}
                                    aria-label={panelOpen ? t('hide_controls') : t('show_controls')}
                                >
                                    {panelOpen ? '✕' : '☰'}
                                </Button>
                            </Box>

                            {/* Control Panel: collapsible on mobile, always visible on desktop */}
                            <Box
                                sx={{
                                    display: { xs: panelOpen ? 'flex' : 'none', sm: 'flex' },
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: { xs: 1, sm: 2 },
                                    width: '100%',
                                    maxWidth: 800,
                                    mb: { xs: 1, sm: 2 },
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Dropdowns container */}
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 2 }, maxWidth: { xs: '60%', sm: '70%' } }}>
                                    <LanguageSetSelector
                                        selectedLanguageSetId={selectedLanguageSetId}
                                        onLanguageSetChange={handleLanguageSetChange}
                                    />
                                    <CategorySelector
                                        categories={visibleCategories}
                                        selected={selectedCategory}
                                        onSelect={cat => setSelectedCategory(cat)}
                                    />
                                    <FormControl fullWidth size="small">
                                        <InputLabel>{t('difficulty')}</InputLabel>
                                        <Select
                                            value={difficulty}
                                            label={t('difficulty')}
                                            onChange={e => setDifficulty(e.target.value)}
                                        >
                                            {availableDifficulties.map(diff => (
                                                <MenuItem key={diff.value} value={diff.value}>
                                                    {t(diff.value)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>

                                {/* Buttons container */}
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'row', sm: 'row' },
                                    alignItems: { xs: 'center', sm: 'flex-start' },
                                    gap: { xs: 1, sm: 2 },
                                    position: 'relative'
                                }}>
                                    {/* Refresh button */}
                                    <GameActionButton
                                        icon="🔄"
                                        desktopText={t('refresh')}
                                        onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                        title={t('reload_puzzle')}
                                        sx={{ height: { xs: 48, sm: 96 } }}
                                    />

                                    {/* Export button */}
                                    <ExportButton
                                        category={selectedCategory}
                                        grid={grid}
                                        phrases={phrases}
                                        disabled={isGridLoading || grid.length === 0 || notEnoughPhrases}
                                        t={t}
                                    />
                                </Box>
                            </Box>

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

                                    {/* Grid loading overlay */}
                                    {isGridLoading && (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            backdropFilter: 'blur(3px)',
                                            bgcolor: isDarkMode ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
                                            zIndex: 15,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 2,
                                        }}>
                                            <CircularProgress
                                                size={48}
                                                color={isDarkMode ? 'inherit' : 'primary'}
                                                sx={{ color: isDarkMode ? '#fff' : 'primary.main' }}
                                            />
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    color: isDarkMode ? '#fff' : 'text.primary',
                                                    fontWeight: 'bold',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {t('loading_puzzle')}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Not enough phrases overlay */}
                                    {notEnoughPhrases && (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            backdropFilter: 'blur(6px)',
                                            bgcolor: isDarkMode ? 'rgba(30,30,30,0.7)' : 'rgba(255,255,255,0.7)',
                                            zIndex: 10,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Box sx={{
                                                bgcolor: isDarkMode ? '#222' : 'rgba(255,255,255,0.95)',
                                                color: isDarkMode ? '#fff' : 'error.main',
                                                borderRadius: 3,
                                                p: 3,
                                                boxShadow: isDarkMode ? 8 : 2,
                                                textAlign: 'center',
                                                fontWeight: 'bold'
                                            }}>
                                                {notEnoughPhrasesMsg || t('not_enough_phrases')}
                                            </Box>
                                        </Box>
                                    )}
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
