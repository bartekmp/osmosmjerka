import axios from 'axios';
import confetti from 'canvas-confetti';
import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { Route, Routes, useLocation, Link } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { Container, Stack, CircularProgress, FormControl, InputLabel, MenuItem, Select, Button } from '@mui/material';
import {
    ScrabbleGrid,
    WordList,
    GameHeader,
    GameControls,
    CategorySelector,
    ExportButton,
    LoadingOverlay,
    AllFoundMessage,
    AdminControls
} from './features';
import { LanguageSwitcher, NightModeButton } from './shared';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import createAppTheme from './theme';
import './style.css';
import './App.css';
import { useTranslation } from 'react-i18next';
import GameActionButton from './shared/components/ui/GameActionButton';
import ResponsiveText from './shared/components/ui/ResponsiveText';

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
    const [panelOpen, setPanelOpen] = useState(false);

    // Winning condition: all words found
    const allFound = words.length > 0 && found.length === words.length;
    
    // Use celebration hook
    const { showCelebration, resetCelebration, celebrationTriggeredRef } = useCelebration(allFound, setLogoFilter);    // Apply theme data attribute to body
    useEffect(() => {
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

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
        axios.get(API_ENDPOINTS.IGNORED_CATEGORIES).then(res => {
            setIgnoredCategories(res.data);
        }).catch(err => {
            console.error('Error loading ignored categories:', err);
        });

        axios.get(API_ENDPOINTS.CATEGORIES).then(res => {
            setCategories(res.data);
            if (res.data.length > 0 && !selectedCategory && restored && grid.length === 0) {
                const randomIndex = Math.floor(Math.random() * res.data.length);
                setSelectedCategory(res.data[randomIndex]);
            }
        }).catch(err => {
            console.error('Error loading categories:', err);
        });
        // eslint-disable-next-line
    }, [restored]);

    // Also load categories immediately, not just when restored
    useEffect(() => {
        axios.get(API_ENDPOINTS.CATEGORIES).then(res => {
            setCategories(res.data);
        }).catch(err => {
            console.error('Error loading categories on mount:', err);
        });
    }, []);

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
        resetCelebration(); // Reset celebration state using hook
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
                {/* Loading overlay */}
                {isLoading && (
                    <Box
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: isDarkMode ? 'rgba(30,30,30,0.7)' : 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(3px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999
                        }}
                    >
                        <Box
                            sx={{
                                backgroundColor: isDarkMode ? '#222' : 'white',
                                color: isDarkMode ? '#fff' : 'inherit',
                                borderRadius: 2,
                                p: 3,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                                boxShadow: isDarkMode ? 8 : 2
                            }}
                        >
                            <CircularProgress size={40} color={isDarkMode ? 'inherit' : 'primary'} />
                            <Typography variant="body1">{t('loading_puzzle')}</Typography>
                        </Box>
                    </Box>
                )}

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
                            {/* Header with logo, title, and controls in the same row */}
                            <Box sx={{
                                position: 'relative',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                mt: 2,
                                mb: 3, // Add bottom margin to prevent overlap with content below
                                px: { xs: 1, sm: 2 },
                                minHeight: { xs: 48, sm: 56, md: 64, lg: 72 } // Ensure minimum height
                            }}>
                                {/* Logo and title - centered within available space */}
                                <Box sx={{
                                    position: 'absolute',
                                    left: 0,
                                    right: { xs: '80px', sm: '150px', md: '180px' }, // Adjusted for unified sizing
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: { xs: 1, sm: 2 },
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    px: { xs: 1, sm: 2 } // Add padding to prevent edge touching
                                }}
                                    onClick={handleLogoClick}
                                >
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            height: { xs: 38, sm: 36, md: 44, lg: 56 },
                                            width: { xs: 38, sm: 36, md: 44, lg: 56 },
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Box
                                            component="img"
                                            src="/static/android-chrome-512x512.png"
                                            alt="Osmosmjerka logo"
                                            sx={{
                                                height: '100%',
                                                width: '100%',
                                                filter: logoFilter,
                                                transition: 'filter 0.3s ease',
                                                userSelect: 'none',
                                                position: 'relative',
                                                zIndex: 1,
                                            }}
                                            onError={e => { e.target.onerror = null; e.target.src = "/static/favicon-32x32.png"; }}
                                        />
                                    </Box>
                                    <Typography
                                        variant="h1"
                                        sx={{
                                            fontSize: { xs: '1.9rem', sm: '1.8rem', md: '2.5rem', lg: '3.2rem' }, // Increased xs font size
                                            textAlign: 'center',
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            minWidth: 0,
                                            maxWidth: '100%',
                                            // Add wobble animation when celebrating
                                            animation: showCelebration ? 'title-wobble 0.5s ease-in-out 6' : 'none',
                                            '@keyframes title-wobble': {
                                                '0%, 100%': {
                                                    transform: 'rotate(0deg) scale(1)',
                                                },
                                                '25%': {
                                                    transform: 'rotate(-3deg) scale(1.05)',
                                                },
                                                '50%': {
                                                    transform: 'rotate(0deg) scale(1.1)',
                                                },
                                                '75%': {
                                                    transform: 'rotate(3deg) scale(1.05)',
                                                },
                                            }
                                        }}
                                    >
                                        Osmosmjerka
                                    </Typography>
                                </Box>

                                {/* Controls - positioned absolutely on the right */}
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        right: 0,
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: { xs: 1, sm: 1, md: 1 }, // Uniform gaps across all screen sizes
                                        zIndex: 1
                                    }}
                                >
                                    <LanguageSwitcher
                                        sx={{
                                            minWidth: { xs: 36, sm: 44, md: 48 },
                                            height: { xs: 36, sm: 44, md: 48 },
                                            minHeight: { xs: 36, sm: 44, md: 48 },
                                        }}
                                    />
                                    <Button
                                        component={Link}
                                        to="/admin"
                                        sx={{
                                            display: { xs: 'none', sm: 'flex' },
                                            minWidth: { sm: 44, md: 48 },
                                            height: { sm: 44, md: 48 },
                                            minHeight: { sm: 44, md: 48 },
                                            fontSize: { sm: '0.8rem', md: '0.9rem' },
                                            px: { sm: 0.75, md: 1 }
                                        }}
                                    >
                                        {t('profile')}
                                    </Button>
                                    <NightModeButton
                                        sx={{
                                            minWidth: { xs: 36, sm: 44, md: 48 },
                                            height: { xs: 36, sm: 44, md: 48 },
                                            minHeight: { xs: 36, sm: 44, md: 48 },
                                            padding: { xs: 0.5, sm: 0.75, md: 1 },
                                        }}
                                    />
                                </Box>
                            </Box>

                            {/* Toggle button for mobile, only when menu is closed */}
                            {!panelOpen && (
                                <Box sx={{
                                    display: { xs: 'flex', sm: 'none' },
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                    justifyContent: 'center',
                                    mb: 1,
                                }}>
                                    <Button
                                        onClick={() => setPanelOpen(true)}
                                        sx={{
                                            minWidth: 0,
                                            width: 180,
                                            height: 40,
                                            mr: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        aria-label={t('show_controls')}
                                    >
                                        {t('menu')} ⬇️
                                    </Button>
                                </Box>
                            )}

                            {/* Control Panel: collapsible on mobile, always visible on desktop */}
                            <Box
                                sx={{
                                    display: { xs: panelOpen ? 'flex' : 'none', sm: 'flex' },
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: 2,
                                    width: '100%',
                                    maxWidth: 600,
                                    mb: { xs: 1, sm: 2 },
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Dropdowns container */}
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: { xs: '40%', sm: '70%' } }}>
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
                                        words={words}
                                        disabled={isLoading || grid.length === 0 || notEnoughWords}
                                        t={t}
                                    />

                                    {/* Hide menu button for mobile, only when menu is open */}
                                    {panelOpen && (
                                        <Button
                                            onClick={() => setPanelOpen(false)}
                                            sx={{
                                                display: { xs: 'flex', sm: 'none' },
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: 0,
                                                width: 48,
                                                height: 48,
                                                fontSize: '1.5rem',
                                                p: 0
                                            }}
                                            aria-label={t('hide_controls')}
                                        >
                                            ⬆️
                                        </Button>
                                    )}
                                </Box>
                            </Box>

                            {/* All Found Message */}
                            {allFound && (
                                <Box sx={{
                                    textAlign: 'center',
                                    color: 'success.main',
                                    fontWeight: 'bold',
                                    fontSize: { xs: '1rem', sm: '1.2rem' },
                                    minHeight: { xs: 16, sm: 24 },
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: { xs: 1, sm: 2 },
                                    mb: { xs: 0.5, sm: 1 }
                                }}>
                                    <Typography
                                        variant="h6"
                                        color="success.main"
                                        sx={{
                                            mb: 0,
                                            fontSize: { xs: '1rem', sm: '1.2rem' },
                                            lineHeight: 1.2
                                        }}
                                    >
                                        🎉 {t('all_words_found')} 🎊
                                    </Typography>
                                    <Button
                                        onClick={() => loadPuzzle(selectedCategory, difficulty)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            fontSize: { xs: '0.8rem', sm: '1rem' },
                                            py: { xs: 0.2, sm: 1 },
                                            px: { xs: 1, sm: 3 },
                                            minHeight: { xs: 28, sm: 36 }
                                        }}
                                    >
                                        <ResponsiveText 
                                            desktop={t('new_game')} 
                                            mobile="🎮" 
                                        />
                                    </Button>
                                </Box>
                            )}

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
                                        words={words}
                                        found={found}
                                        onFound={markFound}
                                        disabled={allFound}
                                        isDarkMode={isDarkMode}
                                        showCelebration={showCelebration}
                                    />
                                    {notEnoughWords && (
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
                                                {notEnoughWordsMsg || t('not_enough_words')}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: 320 }, maxWidth: 400, alignSelf: { xs: 'flex-start', md: 'flex-start' }, position: { md: 'relative' }, left: { md: '0' }, top: { md: '0' } }}>
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
