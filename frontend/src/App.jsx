import { Box, CircularProgress, Container, CssBaseline, ThemeProvider as MUIThemeProvider, Stack, Typography, IconButton } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
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
    ScrabbleGrid,
    Timer,
    ScoreDisplay,
    HintButton
} from './features';
import { NotEnoughPhrasesOverlay, SplashScreen } from './shared';
import './style.css';
import createAppTheme from './theme';

// Import custom hooks
import useCelebration from './hooks/useCelebration';
import useGameDifficulties from './hooks/useGameDifficulties';
import useLogoColor from './hooks/useLogoColor';
import { useDebouncedValue } from './hooks/useDebounce';

import { loadPuzzle as loadPuzzleHelper, restoreGameState, saveGameState } from './helpers/appHelpers';
import { API_ENDPOINTS, STORAGE_KEYS } from './shared/constants/constants';
import { RateLimitWarning } from './shared/components/ui/RateLimitWarning';
import packageJson from '../package.json';

// Lazy load admin components
const AdminPanel = lazy(() => import('./features').then(module => ({ default: module.AdminPanel })));
const UserManagement = lazy(() => import('./features').then(module => ({ default: module.UserManagement })));
const UserProfile = lazy(() => import('./features').then(module => ({ default: module.UserProfile })));

const SPLASH_EXIT_DURATION = 600;
const SPLASH_MIN_VISIBLE_DURATION = 1200;

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
            } catch (error) {
                // Ignore parsing errors
                console.warn('Failed to parse stored game state:', error);
            }
        }
        return false;
    });
    const [restored, setRestored] = useState(false);
    const [notEnoughPhrases, setNotEnoughPhrases] = useState(false);
    const [notEnoughPhrasesMsg, setNotEnoughPhrasesMsg] = useState("");
    const [isGridLoading, setIsGridLoading] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [showRateLimit, setShowRateLimit] = useState(false);

    const [languageSetsStatus, setLanguageSetsStatus] = useState('pending');
    const [categoriesStatus, setCategoriesStatus] = useState('pending');
    const [gridStatus, setGridStatus] = useState('pending');
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    // Game session tracking for statistics
    const [gameSessionId, setGameSessionId] = useState(null);
    const [gameStartTime, setGameStartTime] = useState(null);
    const [currentElapsedTime, setCurrentElapsedTime] = useState(0); // Track current elapsed time for saving
    const [lastFoundCount, setLastFoundCount] = useState(0);
    const [sessionCompleted, setSessionCompleted] = useState(false);
    const [statisticsEnabled, setStatisticsEnabled] = useState(true); // Default to true, will be checked from server

    // Scoring system state
    const [scoringEnabled, setScoringEnabled] = useState(true);
    const [currentScore, setCurrentScore] = useState(0);
    const [scoreBreakdown, setScoreBreakdown] = useState(null);
    const [firstPhraseTime, setFirstPhraseTime] = useState(null);
    const [timerResetTrigger, setTimerResetTrigger] = useState(0);

    // Progressive hint system state
    const [progressiveHintsEnabled, setProgressiveHintsEnabled] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [remainingHints, setRemainingHints] = useState(3);
    const [currentHintLevel, setCurrentHintLevel] = useState(0);

    // Debounced language set ID to prevent excessive API calls
    const debouncedLanguageSetId = useDebouncedValue(selectedLanguageSetId, 500);

    // Refs to prevent duplicate API calls in StrictMode
    const lastFetchedLanguageSetIdRef = useRef(null);
    const completionInProgressRef = useRef(false);
    const splashShownAtRef = useRef(Date.now());

    // Winning condition: all phrases found
    const allFound = phrases.length > 0 && found.length === phrases.length;

    // Use celebration hook
    const { showCelebration, resetCelebration } = useCelebration(allFound, setLogoFilter);

    // Memoized callback for language set changes to prevent unnecessary re-renders
    const handleLanguageSetChange = useCallback((languageSetId) => {
        setSelectedLanguageSetId(languageSetId);
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, languageSetId?.toString() || '');
        // Clear current game state when changing language set
        setGrid([]);
        setPhrases([]);
        setFound([]);
        
        // Reset session tracking state when changing language set
        setSessionCompleted(false);
        setGameSessionId(null);
        setGameStartTime(null);
        setLastFoundCount(0);
    }, []);

    const handleLanguageSetStatusChange = useCallback((status) => {
        setLanguageSetsStatus(status);

        if (status === 'empty' || status === 'error') {
            setCategoriesStatus(prev => (prev === 'pending' ? status : prev));
            setGridStatus(prev => (prev === 'pending' ? status : prev));
        }
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
            setRestored,
            setGameStartTime,
            setCurrentElapsedTime,
            setGridStatus
        });
         
    }, []);

    // Load default and user-specific ignored categories when language set changes
    useEffect(() => {
        if (!debouncedLanguageSetId) {
            setIgnoredCategories([]);
            setUserIgnoredCategories([]);
            return;
        }

        // Load default ignored categories for the language set
        axios.get(`${API_ENDPOINTS.DEFAULT_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`)
            .then(res => setIgnoredCategories(res.data))
            .catch((err) => {
                setIgnoredCategories([]);
                if (err.response?.status === 429) {
                    setShowRateLimit(true);
                    setTimeout(() => setShowRateLimit(false), 4000);
                }
            });

        // Load user-specific ignored categories
        const token = localStorage.getItem('adminToken'); // reuse admin token if logged in
        axios.get(`${API_ENDPOINTS.USER_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).then(res => setUserIgnoredCategories(res.data))
            .catch((err) => {
                setUserIgnoredCategories([]);
                if (err.response?.status === 429) {
                    setShowRateLimit(true);
                    setTimeout(() => setShowRateLimit(false), 4000);
                }
            });
    }, [debouncedLanguageSetId]);

    useEffect(() => {
        // Only run after game state restoration is complete
        if (!restored) return;

        // Prevent duplicate API calls for the same language set
        if (lastFetchedLanguageSetIdRef.current === debouncedLanguageSetId) return;
        lastFetchedLanguageSetIdRef.current = debouncedLanguageSetId;

        // Load categories with language set parameter
        let categoriesUrl = API_ENDPOINTS.CATEGORIES;
        if (debouncedLanguageSetId) {
            categoriesUrl += `?language_set_id=${debouncedLanguageSetId}`;
        }

        setCategoriesStatus('pending');
        axios.get(categoriesUrl).then(res => {
            setCategories(res.data);
            if (res.data.length === 0) {
                setCategoriesStatus('empty');
                setGridStatus('empty');
                return;
            }
            setCategoriesStatus('success');
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
            setCategoriesStatus('error');
            setGridStatus('error');
            if (err.response?.status === 429) {
                setShowRateLimit(true);
                setTimeout(() => setShowRateLimit(false), 4000);
            }
            lastFetchedLanguageSetIdRef.current = null; // Reset on error to allow retry
        });
    }, [restored, debouncedLanguageSetId]);

    useEffect(() => {
        if (initialLoadComplete || !restored) {
            return;
        }

        const statuses = [languageSetsStatus, categoriesStatus, gridStatus];
        const isWaiting = statuses.some(status => status === 'pending');

        if (isWaiting) {
            return;
        }

        const elapsed = Date.now() - splashShownAtRef.current;
        if (elapsed >= SPLASH_MIN_VISIBLE_DURATION) {
            setInitialLoadComplete(true);
            return;
        }

        const timeout = setTimeout(() => setInitialLoadComplete(true), SPLASH_MIN_VISIBLE_DURATION - elapsed);
        return () => clearTimeout(timeout);
    }, [languageSetsStatus, categoriesStatus, gridStatus, initialLoadComplete, restored]);

    useEffect(() => {
        if (!restored || !initialLoadComplete) {
            if (!showSplash) {
                splashShownAtRef.current = Date.now();
            }
            setShowSplash(true);
            return;
        }

        const timeout = setTimeout(() => setShowSplash(false), SPLASH_EXIT_DURATION);
        return () => clearTimeout(timeout);
    }, [initialLoadComplete, restored, showSplash]);

    // Check if statistics are enabled on the server
    const checkStatisticsEnabled = useCallback(async () => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token) {
            setStatisticsEnabled(false);
            return;
        }

        try {
            // First, verify if the token is valid by checking user profile
            const profileResponse = await axios.get(`${API_ENDPOINTS.USER_PROFILE}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!profileResponse.data) {
                setStatisticsEnabled(false);
                return;
            }

            // For all users, enable statistics by default
            setStatisticsEnabled(true);

            // If user is root admin, check if statistics are explicitly disabled on server
            if (profileResponse.data.role === 'root_admin') {
                try {
                    const response = await axios.get(`${API_ENDPOINTS.ADMIN}/settings/statistics-enabled`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    // Only disable if explicitly set to false
                    if (response.data.enabled === false) {
                        setStatisticsEnabled(false);
                    }
                } catch (_settingsError) {
                    // If settings endpoint fails, keep statistics enabled (default behavior)
                    console.warn('Failed to load statistics settings:', _settingsError);
                }
            }
        } catch (_error) {
            // If error (e.g., unauthorized, settings not found), disable statistics
            console.warn('Failed to check statistics enabled status:', _error);
            setStatisticsEnabled(false);
        }
    }, []);

    // Check statistics enabled status on component mount and when auth changes
    useEffect(() => {
        checkStatisticsEnabled();
        
        // Also check when auth token changes
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (token) {
            checkStatisticsEnabled();
        }
    }, [checkStatisticsEnabled]);

    // Check scoring and hint preferences
    const checkUserPreferences = useCallback(async () => {
        try {
            // Check system-wide scoring preference (public endpoint)
            const scoringResponse = await axios.get(`${API_ENDPOINTS.GAME}/system/scoring-enabled`);
            setScoringEnabled(scoringResponse.data.enabled);

            // Check system-wide progressive hints preference (public endpoint)
            const hintsResponse = await axios.get(`${API_ENDPOINTS.GAME}/system/progressive-hints-enabled`);
            setProgressiveHintsEnabled(hintsResponse.data.enabled);
        } catch (error) {
            console.error('Failed to check system preferences:', error);
            setScoringEnabled(false);
            setProgressiveHintsEnabled(false);
        }
    }, []);

    // Check preferences on mount and auth changes
    useEffect(() => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (token) {
            checkUserPreferences();
        }
    }, [checkUserPreferences]);

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
            elapsedTimeSeconds: currentElapsedTime, // Save tracked elapsed time
        });
    }, [grid, phrases, found, selectedCategory, difficulty, hidePhrases, allFound, showTranslations, selectedLanguageSetId, currentElapsedTime]);

    useEffect(() => {
        if (!restored) return;
        if (selectedCategory && grid.length === 0) {
            loadPuzzle(selectedCategory, difficulty);
        }
    }, [restored, selectedCategory, difficulty]);

    const loadPuzzle = (category, diff = difficulty, refresh = false) => {
        setIsGridLoading(true);
        setGridStatus('pending');
        resetCelebration(); // Reset celebration state using hook
        
        // Reset session tracking state when loading a new puzzle
        setSessionCompleted(false);
        setGameSessionId(null);
        setGameStartTime(null);
        setLastFoundCount(0);
        completionInProgressRef.current = false; // Reset completion flag for new puzzle
        
        // Reset scoring and hint state
        resetGameState();
        
        return loadPuzzleHelper(category, diff, {
            setSelectedCategory,
            setGrid,
            setPhrases,
            setFound,
            setHidePhrases,
            setShowTranslations,
            setNotEnoughPhrases,
            setNotEnoughPhrasesMsg
        }, t, selectedLanguageSetId, refresh).then((result) => {
            if (result?.status === 'error') {
                setGridStatus('error');
            } else if (result?.status === 'empty') {
                setGridStatus('empty');
            } else {
                setGridStatus('success');
            }
        }).catch(() => {
            setGridStatus('error');
        }).finally(() => {
            setIsGridLoading(false);
        });
    };

    // Create a separate refresh function for clarity
    const refreshPuzzle = (category, diff = difficulty) => {
        loadPuzzle(category, diff, true);
    };

    // Game session tracking functions
    const startGameSession = useCallback(async (category, difficulty, gridSize, totalPhrases) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token || !selectedLanguageSetId || !statisticsEnabled) {
            return;
        }

        try {
            const response = await axios.post(`${API_ENDPOINTS.GAME}/game/start`, {
                language_set_id: selectedLanguageSetId,
                category,
                difficulty,
                grid_size: gridSize,
                total_phrases: totalPhrases
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setGameSessionId(response.data.session_id);
            // Only set gameStartTime if not already set (for restored games)
            if (!gameStartTime) {
                setGameStartTime(Date.now());
            }
            setLastFoundCount(0);
            setSessionCompleted(false);
            completionInProgressRef.current = false; // Reset completion flag for new session
        } catch (error) {
            console.error('Failed to start game session:', error);
        }
    }, [selectedLanguageSetId, statisticsEnabled, gameStartTime]);

    const updateGameProgress = useCallback(async (phrasesFound) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token || !gameSessionId || !statisticsEnabled) {
            return;
        }

        try {
            await axios.put(`${API_ENDPOINTS.GAME}/game/progress`, {
                session_id: gameSessionId,
                phrases_found: phrasesFound
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Failed to update game progress:', error);
        }
    }, [gameSessionId, statisticsEnabled]);

    const saveGameScore = useCallback(async (phrasesFound, durationSeconds, isCompleted) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token || !gameSessionId || !scoringEnabled) return;

        try {
            const completionTime = isCompleted ? new Date().toISOString() : null;
            
            await axios.post(`${API_ENDPOINTS.GAME}/game/score`, {
                session_id: gameSessionId,
                language_set_id: selectedLanguageSetId,
                category: selectedCategory,
                difficulty: difficulty,
                grid_size: grid.length,
                total_phrases: phrases.length,
                phrases_found: phrasesFound,
                hints_used: hintsUsed,
                duration_seconds: durationSeconds,
                first_phrase_time: firstPhraseTime,
                completion_time: completionTime
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Failed to save game score:', error);
        }
    }, [gameSessionId, scoringEnabled, selectedLanguageSetId, selectedCategory, difficulty, 
        grid.length, phrases.length, hintsUsed, firstPhraseTime]);

    const completeGameSession = useCallback(async (phrasesFound, isCompleted) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token || !gameSessionId || !gameStartTime || sessionCompleted || completionInProgressRef.current || !statisticsEnabled) {
            return;
        }

        // Set flag to prevent duplicate calls
        completionInProgressRef.current = true;

        try {
            const durationSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
            
            await axios.post(`${API_ENDPOINTS.GAME}/game/complete`, {
                session_id: gameSessionId,
                phrases_found: phrasesFound,
                duration_seconds: durationSeconds
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Save final score if scoring is enabled
            if (scoringEnabled) {
                await saveGameScore(phrasesFound, durationSeconds, isCompleted);
            }

            // Reset session tracking
            setSessionCompleted(true);
            setGameSessionId(null);
            setGameStartTime(null);
            setLastFoundCount(0);
        } catch (error) {
            console.error('Failed to complete game session:', error);
        } finally {
            // Reset flag after completion (successful or failed)
            completionInProgressRef.current = false;
        }
    }, [gameSessionId, gameStartTime, sessionCompleted, statisticsEnabled, scoringEnabled, saveGameScore]);

    // Scoring system functions
    const calculateCurrentScore = useCallback((phrasesFound, timePlayed) => {
        if (!scoringEnabled) return 0;

        const baseScore = phrasesFound * 100;
        
        // Difficulty multipliers
        const difficultyMultipliers = {
            easy: 1.0,
            medium: 1.2,
            hard: 1.5,
            very_hard: 2.0
        };
        
        const difficultyBonus = Math.floor(baseScore * (difficultyMultipliers[difficulty] - 1.0));
        
        // Time bonus (for ongoing games, no completion bonus yet)
        let timeBonus = 0;
        if (timePlayed > 0) {
            const targetTimes = {
                easy: 300,
                medium: 600,
                hard: 900,
                very_hard: 1200
            };
            const targetTime = targetTimes[difficulty] || 600;
            
            if (timePlayed <= targetTime) {
                const timeRatio = Math.max(0, (targetTime - timePlayed) / targetTime);
                timeBonus = Math.floor(baseScore * 0.5 * timeRatio);
            }
        }
        
        const hintPenalty = hintsUsed * 50;
        
        return Math.max(0, baseScore + difficultyBonus + timeBonus - hintPenalty);
    }, [scoringEnabled, difficulty, hintsUsed]);

    const updateScore = useCallback((phrasesFound, timePlayed = 0) => {
        if (!scoringEnabled) return;
        
        const score = calculateCurrentScore(phrasesFound, timePlayed);
        setCurrentScore(score);
    }, [scoringEnabled, calculateCurrentScore]);

    // Hint system functions
    const handleHintRequest = useCallback(async () => {
        if (remainingHints <= 0 || !gridRef.current) return;

        if (progressiveHintsEnabled) {
            // Progressive hint mode
            if (currentHintLevel === 0) {
                // Start new progressive hint sequence
                const targetPhrase = gridRef.current.showProgressiveHint(true);
                if (targetPhrase) {
                    setCurrentHintLevel(1);
                    setRemainingHints(prev => prev - 1);
                    setHintsUsed(prev => prev + 1);
                }
            } else {
                // Advance to next hint level
                gridRef.current.advanceProgressiveHint();
                setCurrentHintLevel(prev => prev + 1);
                setRemainingHints(prev => prev - 1);
                setHintsUsed(prev => prev + 1);
                
                // Reset hint level after final hint
                if (currentHintLevel >= 2) {
                    setTimeout(() => {
                        setCurrentHintLevel(0);
                        if (gridRef.current) {
                            gridRef.current.clearHints();
                        }
                    }, 3000);
                }
            }
        } else {
            // Classic hint mode
            const targetPhrase = gridRef.current.showProgressiveHint(false);
            if (targetPhrase) {
                setHintsUsed(prev => prev + 1);
                // No limit on classic hints, but still track usage for scoring
            }
        }
    }, [remainingHints, progressiveHintsEnabled, currentHintLevel]);

    const resetGameState = useCallback(() => {
        setCurrentScore(0);
        setScoreBreakdown(null);
        setHintsUsed(0);
        setRemainingHints(3);
        setCurrentHintLevel(0);
        setFirstPhraseTime(null);
        setCurrentElapsedTime(0);
        setFound([]);
        setTimerResetTrigger(prev => prev + 1);

        if (gridRef.current) {
            gridRef.current.clearHints();
        }
    }, []);

    const markFound = useCallback((phrase) => {
        if (!found.includes(phrase)) {
            const newFoundList = [...found, phrase];
            const newFoundCount = newFoundList.length;
            
            // Start timer on first found phrase
            if (found.length === 0 && scoringEnabled) {
                const now = new Date().toISOString();
                setFirstPhraseTime(now);
            }
            
            // Start game session on first found phrase (only if statistics are enabled)
            if (found.length === 0 && phrases.length > 0 && grid.length > 0 && selectedCategory && !gameSessionId && !sessionCompleted && statisticsEnabled) {
                const gridSize = grid.length;
                startGameSession(selectedCategory, difficulty, gridSize, phrases.length);
            }
            
            setFound(newFoundList);
            confetti();
            
            // Clear any active hints when phrase is found
            if (gridRef.current) {
                gridRef.current.clearHints();
            }
            setCurrentHintLevel(0);
            
            // Update progress tracking
            updateGameProgress(newFoundCount);
            
            // Update score if scoring is enabled
            if (scoringEnabled && gameStartTime) {
                const timePlayed = Math.floor((Date.now() - gameStartTime) / 1000);
                updateScore(newFoundCount, timePlayed);
            }
        }
    }, [found, phrases.length, grid.length, selectedCategory, gameSessionId, sessionCompleted, 
        difficulty, startGameSession, statisticsEnabled, scoringEnabled, gameStartTime, 
        updateGameProgress, updateScore]);

    const handlePhraseClick = (phrase) => {
        // Only allow phrase clicking when progressive hints are disabled
        if (!progressiveHintsEnabled && gridRef.current) {
            gridRef.current.blinkPhrase(phrase);
        }
    };

    // Timer update callback
    const handleTimerUpdate = useCallback((elapsedSeconds) => {
        setCurrentElapsedTime(elapsedSeconds); // Track current elapsed time for saving
        if (scoringEnabled && found.length > 0) {
            updateScore(found.length, elapsedSeconds);
        }
    }, [scoringEnabled, found.length, updateScore]);

    // Game session tracking effects
    // Note: Game session now starts when first phrase is found (see markFound function)
    
    useEffect(() => {
        // Update progress when found phrases change
        if (gameSessionId && found.length !== lastFoundCount) {
            updateGameProgress(found.length);
            setLastFoundCount(found.length);
        }
    }, [found.length, gameSessionId, lastFoundCount, updateGameProgress]);

    useEffect(() => {
        // Complete session when all phrases are found (only once)
        if (allFound && gameSessionId && gameStartTime && !sessionCompleted) {
            completeGameSession(found.length, true);
        }
    }, [allFound, gameSessionId, gameStartTime, sessionCompleted, completeGameSession, found.length]);

    useEffect(() => {
        // Complete session when starting a new game (if there was a previous incomplete session)
        const currentGameSessionId = gameSessionId;
        const currentSessionCompleted = sessionCompleted;
        const currentFoundLength = found.length;
        
        return () => {
            if (currentGameSessionId && !currentSessionCompleted && !completionInProgressRef.current) {
                completeGameSession(currentFoundLength, false);
            }
        };
    }, [selectedCategory, difficulty, completeGameSession]); // Only reset when starting new game

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

    // Callback function for AdminPanel to update user ignored categories
    const updateUserIgnoredCategories = (newCategories) => {
        setUserIgnoredCategories(newCategories);
    };

    return (
        <MUIThemeProvider theme={createAppTheme(isDarkMode)}>
            <CssBaseline />
            {showSplash && (
                <SplashScreen
                    open={!initialLoadComplete}
                    messageKey="loading_game"
                    isDarkMode={isDarkMode}
                    exitDuration={SPLASH_EXIT_DURATION}
                />
            )}
            <Container maxWidth="xl" sx={{ minHeight: '100vh', py: 2, position: 'relative' }}>
                {/* Top controls row for admin routes only */}
                {isAdminRoute && <AdminControls />}

                <Routes>
                    <Route path="/admin" element={
                        <Suspense fallback={<CircularProgress />}>
                            <AdminPanel 
                                ignoredCategories={ignoredCategories}
                                userIgnoredCategories={userIgnoredCategories}
                                onUpdateUserIgnoredCategories={updateUserIgnoredCategories}
                            />
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
                                refreshPuzzle={refreshPuzzle}
                                selectedCategoryState={selectedCategory}
                                difficultyState={difficulty}
                                grid={grid}
                                phrases={phrases}
                                isLoading={isGridLoading}
                                notEnoughPhrases={notEnoughPhrases}
                                selectedLanguageSetId={selectedLanguageSetId}
                                onLanguageSetChange={handleLanguageSetChange}
                                onLanguageSetStatusChange={handleLanguageSetStatusChange}
                            />

                            {/* All Found Message */}
                            <AllFoundMessage
                                allFound={allFound}
                                loadPuzzle={loadPuzzle}
                                refreshPuzzle={refreshPuzzle}
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
                                        onHintUsed={() => {}} // Placeholder - hint tracking is handled in handleHintRequest
                                    />

                                    <LoadingOverlay isLoading={isGridLoading} isDarkMode={isDarkMode} />

                                    <NotEnoughPhrasesOverlay
                                        show={notEnoughPhrases}
                                        message={notEnoughPhrasesMsg}
                                        isDarkMode={isDarkMode}
                                    />
                                </Box>
                                <Box sx={{ width: { xs: '100%', md: 320 }, maxWidth: 400, alignSelf: { xs: 'flex-start', md: 'flex-start' }, position: { md: 'relative' }, left: { md: '0' }, top: { md: '0' } }}>
                                    {/* Timer and Score Display */}
                                    {scoringEnabled && (
                                        <Box sx={{ 
                                            display: 'flex', 
                                            flexDirection: { xs: 'row', sm: 'row' },
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            gap: 2,
                                            mb: 2 
                                        }}>
                                            <Timer
                                                isActive={found.length > 0 && !allFound && !isAdminRoute}
                                                onTimeUpdate={handleTimerUpdate}
                                                startTime={gameStartTime}
                                                resetTrigger={timerResetTrigger}
                                                showTimer={scoringEnabled}
                                                currentElapsedTime={currentElapsedTime}
                                            />
                                            <ScoreDisplay
                                                currentScore={currentScore}
                                                scoreBreakdown={scoreBreakdown}
                                                phrasesFound={found.length}
                                                totalPhrases={phrases.length}
                                                hintsUsed={hintsUsed}
                                                showScore={scoringEnabled}
                                                compact={true}
                                            />
                                        </Box>
                                    )}
                                    
                                    {/* Hint Button - only show when progressive hints are enabled */}
                                    {progressiveHintsEnabled && phrases.length > 0 && found.length < phrases.length && (
                                        <HintButton
                                            onHintRequest={handleHintRequest}
                                            remainingHints={remainingHints}
                                            isProgressiveMode={progressiveHintsEnabled}
                                            disabled={allFound || phrases.length === 0}
                                            currentHintLevel={currentHintLevel}
                                            maxHints={3}
                                            showHintButton={true}
                                        />
                                    )}
                                    
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
                                        progressiveHintsEnabled={progressiveHintsEnabled}
                                        t={t}
                                    />
                                </Box>
                            </Box>
                        </Stack>
                    } />
                </Routes>
                
                {/* Footer */}
                <Box
                    component="footer"
                    sx={{
                        mt: 4,
                        py: 3,
                        borderTop: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2
                    }}
                >
                    <Typography 
                        variant="body2" 
                        color="text.secondary"
                        component="a"
                        href={`https://github.com/bartekmp/osmosmjerka/releases/tag/v${packageJson.version}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ 
                            textDecoration: 'none',
                            color: 'text.secondary',
                            '&:hover': {
                                textDecoration: 'underline',
                                color: 'primary.main'
                            }
                        }}
                    >
                        Osmosmjerka v{packageJson.version}
                    </Typography>
                    <Box sx={{ height: 20, width: 1, bgcolor: 'divider' }} />
                    <IconButton
                        size="small"
                        href="https://github.com/bartekmp/osmosmjerka"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: 'text.secondary' }}
                        aria-label="GitHub Repository"
                    >
                        <GitHubIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Container>

            {/* Rate Limit Warning */}
            <RateLimitWarning 
                show={showRateLimit}
                onClose={() => setShowRateLimit(false)}
                message={t('common.rateLimitWarning', 'Please wait before making another request. The server is processing your previous request.')}
            />
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
