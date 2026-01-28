import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListIcon from '@mui/icons-material/List';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import ScrabbleGrid from '../../game/components/Grid/Grid';
import CrosswordGrid from '../../game/components/CrosswordGrid/CrosswordGrid';
import PhraseList from '../../game/components/PhraseList/PhraseList';
import { Timer } from '../../game/components/Timer';
import MobilePhraseListSheet from '../../game/components/MobilePhraseListSheet';
import HintButton from '../../game/components/HintButton/HintButton';
import { LanguageSwitcher, NightModeButton } from '../../../shared';
import { getAssetUrl } from '../../../shared/utils/assets';
import { useThemeMode } from '../../../contexts/ThemeContext';
import { useTouchDevice } from '../../../hooks/useTouchDevice';
import useLogoColor from '../../../hooks/useLogoColor';
import '../../game/components/MobilePhraseListSheet/MobilePhraseListSheet.css';

/**
 * TeacherPuzzlePage - Student-facing page for teacher-created puzzles
 * Accessed via /t/:token
 */
function TeacherPuzzlePage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { isDarkMode } = useThemeMode();

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [puzzleData, setPuzzleData] = useState(null);
    const [nickname, setNickname] = useState('');
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Game state
    const [grid, setGrid] = useState([]);
    const [phrases, setPhrases] = useState([]);
    const [found, setFound] = useState([]);
    const [hidePhrases, setHidePhrases] = useState(true);
    const [showTranslations, setShowTranslations] = useState(false);
    const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
    const [gameStartTime, setGameStartTime] = useState(null);
    const [remainingHints, setRemainingHints] = useState(3);
    const [currentHintLevel, setCurrentHintLevel] = useState(0);

    // Translation input state
    const [translationDialog, setTranslationDialog] = useState({ open: false, phrase: null });
    const [translationInput, setTranslationInput] = useState('');
    const [translationSubmissions, setTranslationSubmissions] = useState([]);
    const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

    const gridRef = useRef(null);

    // Mobile layout detection
    const isTouchDevice = useTouchDevice();
    const [useMobileLayout, setUseMobileLayout] = useState(false);

    useEffect(() => {
        const checkMobileLayout = () => {
            setUseMobileLayout(isTouchDevice && window.innerWidth < 900);
        };
        checkMobileLayout();
        window.addEventListener('resize', checkMobileLayout);
        return () => window.removeEventListener('resize', checkMobileLayout);
    }, [isTouchDevice]);
    const allFound = found.length === phrases.length && phrases.length > 0;

    // Clear any existing session on mount - every refresh starts fresh
    useEffect(() => {
        localStorage.removeItem(`teacher_session_${token}`);
    }, [token]);

    // Check if user is logged in
    useEffect(() => {
        const checkAuth = async () => {
            const authToken = localStorage.getItem('adminToken');
            if (!authToken) {
                setCheckingAuth(false);
                return;
            }

            try {
                const response = await fetch('/admin/profile', {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const userData = await response.json();
                    setCurrentUser(userData);
                    setNickname(userData.username || userData.display_name || '');
                }
            } catch (err) {
                console.error('Failed to check auth:', err);
            } finally {
                setCheckingAuth(false);
            }
        };

        checkAuth();
    }, []);

    // Hooks
    const { logoFilter, changeLogoColor } = useLogoColor();



    // Failsafe loading timeout
    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => {
                if (loading) {
                    console.error('Loading timeout - forcing error state');
                    setLoading(false);
                    if (!puzzleData && !error) {
                        setError(t('teacher.puzzle.error_loading', 'Timeout loading puzzle.'));
                    }
                }
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [loading, puzzleData, error, t]);

    // Validate hotlink and load puzzle config
    const loadPuzzle = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const authToken = localStorage.getItem('adminToken');
            const headers = authToken
                ? { 'Authorization': `Bearer ${authToken}` }
                : {};
            const response = await fetch(`/admin/teacher/set/${token}`, { headers });
            const data = await response.json();

            if (!response.ok) {
                switch (data.error_code) {
                    case 'SET_NOT_FOUND':
                        setError(t('teacher.puzzle.puzzle_not_found', 'This puzzle was not found.'));
                        break;
                    case 'SET_EXPIRED':
                        setError(t('teacher.puzzle.puzzle_expired', 'This puzzle has expired.'));
                        break;
                    case 'SET_INACTIVE':
                        setError(t('teacher.puzzle.puzzle_inactive', 'This puzzle is no longer available.'));
                        break;
                    case 'MAX_PLAYS_REACHED':
                        setError(t('teacher.puzzle.max_plays_reached', 'This puzzle has reached its maximum number of plays.'));
                        break;
                    case 'AUTH_REQUIRED':
                        setError(t('teacher.puzzle.login_required', 'Please log in to access this puzzle.'));
                        break;
                    default:
                        setError(data.message || t('teacher.puzzle.error_loading', 'Error loading puzzle.'));
                }
                return;
            }

            setPuzzleData(data.set);
        } catch {
            setError(t('teacher.puzzle.error_loading', 'Error loading puzzle.'));
        } finally {
            setLoading(false);
        }
    }, [token, t]);

    useEffect(() => {
        if (!sessionStarted) {
            loadPuzzle();
        } else {
            setLoading(false);
        }
    }, [loadPuzzle, sessionStarted]);

    // Start session
    const handleStartSession = async () => {
        const effectiveNickname = currentUser?.username || nickname.trim();
        if (!effectiveNickname) {
            return;
        }

        setLoading(true);
        try {
            const headers = { 'Content-Type': 'application/json' };
            const authToken = localStorage.getItem('adminToken');
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(`/admin/teacher/set/${token}/start`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    nickname: effectiveNickname,
                    grid_size: puzzleData?.config?.grid_size || 10,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                setError(data.message || t('teacher.puzzle.error_starting', 'Error starting session.'));
                return;
            }

            // Set game data
            setGrid(data.grid || []);
            setPhrases(data.phrases || []);
            setFound([]);
            setGameStartTime(new Date());

            // Store session data in state (no localStorage - every refresh starts fresh)
            const session = {
                session_token: data.session_token,
                config: puzzleData?.config || data.config,
                puzzleName: puzzleData?.name,
            };
            setSessionData(session);
            setSessionStarted(true);
        } catch {
            setError(t('teacher.puzzle.error_starting', 'Error starting session.'));
        } finally {
            setLoading(false);
        }
    };

    // Mark phrase as found
    const markFound = useCallback((phrase, latestSubmissions = null) => {
        if (!found.includes(phrase)) {
            const newFound = [...found, phrase];
            setFound(newFound);
            confetti();

            // Clear hints
            if (gridRef.current) {
                gridRef.current.clearHints();
            }

            // Check if all found - complete session
            if (newFound.length === phrases.length) {
                setHidePhrases(false);
                completeSession(newFound.length, latestSubmissions);
            }
        }
    }, [found, phrases.length]);

    // Handle phrase click for hints
    const handlePhraseClick = useCallback((phrase) => {
        if (gridRef.current && !found.includes(phrase)) {
            gridRef.current.blinkPhrase(phrase);
        }
    }, [found]);

    // Handle phrase found - check if translation is required
    const handlePhraseFound = useCallback((phrase) => {
        const config = sessionData?.config || {};
        if (config.require_translation_input) {
            // Show translation dialog instead of marking found immediately
            setTranslationDialog({ open: true, phrase });
            setTranslationInput('');
        } else {
            markFound(phrase);
        }
    }, [sessionData, markFound]);

    // Submit translation and mark phrase as found
    const handleTranslationSubmit = useCallback(() => {
        const phrase = translationDialog.phrase;
        if (!phrase) return;

        // Find the phrase data to get the correct translation
        const phraseData = phrases.find(p => p.phrase === phrase);

        // Sanitize the input: trim, remove HTML tags, limit length
        const sanitizedInput = translationInput
            .trim()
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[<>]/g, '')    // Remove any remaining angle brackets
            .slice(0, 50);           // Enforce max length

        const isCorrect = phraseData &&
            sanitizedInput.toLowerCase() === phraseData.translation?.trim().toLowerCase();

        // Create the new submission object
        const newSubmission = {
            phrase,
            submitted: sanitizedInput,
            correct: phraseData?.translation || '',
            is_correct: isCorrect,
        };

        // Update state but capture the new list to pass down
        const newSubmissionsList = [...translationSubmissions, newSubmission];
        setTranslationSubmissions(newSubmissionsList);

        // Close dialog and mark as found, passing the updated submissions list
        setTranslationDialog({ open: false, phrase: null });
        setTranslationInput('');
        markFound(phrase, newSubmissionsList);
    }, [translationDialog.phrase, translationInput, phrases, markFound, translationSubmissions]);

    // Complete session
    const completeSession = async (phrasesFound, finalSubmissions = null) => {
        if (!sessionData?.session_token) return;

        // Use the passed finalSubmissions if provided, otherwise fall back to state
        // This ensures we don't use stale state when the last move was a translation submission
        const submissionsToSend = finalSubmissions || translationSubmissions;

        try {
            await fetch(`/admin/teacher/set/${token}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: sessionData.session_token,
                    phrases_found: phrasesFound,
                    duration_seconds: currentElapsedTime,
                    translation_submissions: submissionsToSend.length > 0 ? submissionsToSend : undefined,
                }),
            });
        } catch (err) {
            console.error('Failed to complete session:', err);
        }
    };

    // Timer update
    const handleTimerUpdate = useCallback((elapsed) => {
        setCurrentElapsedTime(elapsed);
    }, []);

    // Handle hint request
    const handleHintRequest = useCallback(() => {
        if (!gridRef.current) return;
        if (remainingHints <= 0) return;

        const config = sessionData?.config || {};
        if (config.allow_hints === false) return;

        // Progressive hint logic (matching main game)
        // Level 0: Start sequence (First Letter / Highlight)
        // Level 1: Direction / Pulsate
        // Level 2: Reveal Full Word / Outline

        if (currentHintLevel === 0) {
            // Start new progressive hint sequence
            // Note: showProgressiveHint(true) enables progressive mode in the grid
            const targetPhrase = gridRef.current.showProgressiveHint(true);

            if (targetPhrase) {
                setCurrentHintLevel(1);
                setRemainingHints(prev => Math.max(0, prev - 1));
            }
        } else {
            // Advance to next hint level
            if (gridRef.current.advanceProgressiveHint) {
                gridRef.current.advanceProgressiveHint();
            }

            setCurrentHintLevel(prev => prev + 1);
            setRemainingHints(prev => Math.max(0, prev - 1));

            // Reset hint level after final hint (Level 2 -> 3)
            if (currentHintLevel >= 2) {
                setTimeout(() => {
                    setCurrentHintLevel(0);
                    if (gridRef.current) {
                        gridRef.current.clearHints();
                    }
                }, 3000);
            }
        }
    }, [sessionData, remainingHints, currentHintLevel]);

    // Restart
    const handleRestart = () => {
        localStorage.removeItem(`teacher_session_${token}`);
        setSessionStarted(false);
        setSessionData(null);
        setGrid([]);
        setPhrases([]);
        setFound([]);
        setCurrentElapsedTime(0);
        setGameStartTime(null);
        setTranslationSubmissions([]);  // Reset translation submissions for new session
        setRemainingHints(3);
        setCurrentHintLevel(0);
        loadPuzzle();
    };

    // Loading state
    if (loading) {
        return (
            <Container maxWidth="sm" sx={{ py: 8 }}>
                <Stack alignItems="center" spacing={2}>
                    <CircularProgress />
                    <Typography>{t('loading', 'Loading...')}</Typography>
                </Stack>
            </Container>
        );
    }

    // Error state
    if (error) {
        return (
            <Container maxWidth="sm" sx={{ py: 8 }}>
                <Card>
                    <CardContent>
                        <Stack spacing={3} alignItems="center">
                            <Typography variant="h5" color="error">
                                {t('teacher.puzzle.puzzle_error', 'Puzzle Error')}
                            </Typography>
                            <Alert severity="error">{error}</Alert>
                            <Button
                                variant="contained"
                                onClick={() => navigate('/')}
                            >
                                {t('back_to_game', 'Back to Game')}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        );
    }

    // Session started - show game
    if (sessionStarted && grid.length > 0) {
        const showTimer = sessionData?.config?.show_timer !== false;
        const requireTranslationInput = sessionData?.config?.require_translation_input === true;

        // Correctly extract gameType from config (it's nested in config JSON in the DB)
        const gameType = sessionData?.config?.game_type || puzzleData?.config?.game_type || "word_search";
        const isCrossword = gameType === "crossword";

        // Hide translations if require_translation_input is enabled (to prevent cheating)
        // For crosswords, we ALWAYS show translations (clues)
        const showTranslationsSetting = isCrossword ? true : (!requireTranslationInput && sessionData?.config?.show_translations !== false);

        // Force phrases to be visible in Crossword mode
        if (isCrossword && hidePhrases) {
            setHidePhrases(false);
        }

        return (
            <Container maxWidth="lg" sx={{ py: useMobileLayout ? 1 : 2, px: useMobileLayout ? 0.5 : 2 }}>
                <Stack spacing={useMobileLayout ? 1 : 2}>
                    {/* Header with logo, title, and controls */}
                    <Box sx={{
                        position: 'relative',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        px: { xs: 1, sm: 2 },
                        minHeight: { xs: 48, sm: 56, md: 64 }
                    }}>
                        {/* Logo and Osmosmjerka title */}
                        <Box sx={{
                            position: 'absolute',
                            left: 0,
                            right: { xs: '80px', sm: '100px' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'flex-start', sm: 'center' },
                            gap: { xs: 1, sm: 2 },
                            cursor: 'pointer',
                            overflow: 'hidden',
                            px: { xs: 1, sm: 2 }
                        }}
                            onClick={changeLogoColor}
                        >
                            <Box
                                sx={{
                                    height: { xs: 28, sm: 32, md: 36 },
                                    width: { xs: 28, sm: 32, md: 36 },
                                    flexShrink: 0,
                                }}
                            >
                                <Box
                                    component="img"
                                    src={getAssetUrl("android-chrome-512x512.png")}
                                    alt="Osmosmjerka logo"
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        userSelect: 'none',
                                        filter: logoFilter,
                                        transition: 'filter 0.3s ease',
                                    }}
                                    onError={e => {
                                        e.target.onerror = null;
                                        e.target.src = getAssetUrl("favicon-32x32.png");
                                    }}
                                />
                            </Box>
                            <Typography
                                variant="h1"
                                sx={{
                                    fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem' },
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    '@media (max-width: 349px)': {
                                        display: 'none',
                                    },
                                }}
                            >
                                Osmosmjerka
                            </Typography>
                        </Box>

                        {/* Controls - positioned on the right */}
                        <Box
                            sx={{
                                position: 'absolute',
                                right: 0,
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: { xs: 0.5, sm: 1 },
                                zIndex: 1
                            }}
                        >
                            <LanguageSwitcher
                                sx={{
                                    minWidth: { xs: 36, sm: 44 },
                                    height: { xs: 36, sm: 44 },
                                }}
                            />
                            <NightModeButton
                                sx={{
                                    minWidth: { xs: 36, sm: 44 },
                                    height: { xs: 36, sm: 44 },
                                    padding: { xs: 0.5, sm: 0.75 },
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Puzzle title with back button on desktop */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                    }}>
                        {/* Back Button - Desktop only */}
                        {!useMobileLayout && (
                            <Tooltip title={t('back_to_game', 'Back to Game')} placement="top" arrow>
                                <Button
                                    variant="contained"
                                    onClick={() => navigate('/')}
                                    aria-label={t('back_to_game', 'Back to Game')}
                                    sx={{
                                        minWidth: '40px',
                                        width: '40px',
                                        height: '40px',
                                        padding: 0,
                                        borderRadius: '10px',
                                        border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        boxShadow: (theme) => `1px 2px 0 ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        background: (theme) => theme.palette.mode === 'dark' ? '#4a4a4a' : '#f9e7b3',
                                        color: (theme) => theme.palette.mode === 'dark' ? '#e0e0e0' : '#333',
                                        '&:hover': {
                                            background: (theme) => theme.palette.mode === 'dark' ? '#5a5a5a' : '#f0d99a',
                                        },
                                    }}
                                >
                                    <ArrowBackIcon />
                                </Button>
                            </Tooltip>
                        )}
                        <Typography
                            variant="h5"
                            sx={{
                                color: 'text.secondary',
                                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.4rem' },
                            }}
                        >
                            {sessionData?.puzzleName || t('teacher.puzzle.title', 'Puzzle')}
                        </Typography>
                    </Box>

                    {/* Timer */}
                    {showTimer && (
                        <Box sx={{ textAlign: 'center' }}>
                            <Timer
                                isActive={!allFound && gameStartTime !== null}
                                onTimeUpdate={handleTimerUpdate}
                                startTime={gameStartTime}
                                showTimer={true}
                                currentElapsedTime={currentElapsedTime}
                            />
                        </Box>
                    )}

                    {/* All found message */}
                    {allFound && (
                        <Alert severity="success" sx={{ textAlign: 'center' }}>
                            🎉 {t('all_found', 'All phrases found!')}
                            {showTimer && ` Time: ${Math.floor(currentElapsedTime / 60)}:${(currentElapsedTime % 60).toString().padStart(2, '0')}`}
                        </Alert>
                    )}

                    {/* Game area */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: useMobileLayout ? 2 : 3,
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            width: '100%',
                            maxWidth: '100vw',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Grid */}
                        <Box
                            sx={{
                                flex: '0 0 auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: useMobileLayout ? '100%' : 'auto',
                                maxWidth: '100%',
                            }}
                        >
                            {isCrossword ? (
                                <CrosswordGrid
                                    ref={gridRef}
                                    grid={grid}
                                    phrases={phrases}
                                    onPhraseComplete={(phrase) => {
                                        if (requireTranslationInput) {
                                            handlePhraseFound(phrase);
                                        } else {
                                            markFound(phrase);
                                        }
                                    }}
                                    onPhraseWrong={() => { }}
                                    disabled={allFound || translationDialog.open}
                                    isDarkMode={isDarkMode}
                                    showWrongHighlight={true}
                                    onHintUsed={() => { }}
                                    isTouchDevice={isTouchDevice}
                                    useMobileLayout={useMobileLayout}
                                />
                            ) : (
                                <ScrabbleGrid
                                    ref={gridRef}
                                    grid={grid}
                                    phrases={phrases}
                                    found={found}
                                    onFound={handlePhraseFound}
                                    disabled={allFound || translationDialog.open}
                                    isDarkMode={isDarkMode}
                                    showCelebration={allFound}
                                    isTouchDevice={isTouchDevice}
                                    useMobileLayout={useMobileLayout}
                                />
                            )}
                        </Box>

                        {/* Phrase list - Desktop only */}
                        {!useMobileLayout && (
                            <Box sx={{ width: 280, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <HintButton
                                        onHintRequest={handleHintRequest}
                                        remainingHints={allFound ? 0 : remainingHints}
                                        isProgressiveMode={true}
                                        showHintButton={sessionData?.config?.allow_hints !== false}
                                        gameType={gameType}
                                        currentHintLevel={currentHintLevel}
                                        disabled={allFound}
                                    />
                                </Box>
                                <PhraseList
                                    phrases={phrases}
                                    found={found}
                                    hidePhrases={isCrossword ? false : hidePhrases}
                                    setHidePhrases={isCrossword ? null : setHidePhrases}
                                    allFound={allFound}
                                    showTranslations={showTranslationsSetting && (isCrossword || showTranslations)}
                                    setShowTranslations={isCrossword ? null : (showTranslationsSetting ? setShowTranslations : null)}
                                    disableShowPhrases={isCrossword}
                                    hideToggleButton={isCrossword}
                                    onPhraseClick={handlePhraseClick}
                                    progressiveHintsEnabled={false}
                                    t={t}
                                    gameType={gameType}
                                />
                            </Box>
                        )}
                    </Box>

                    {/* Mobile Layout - Floating Action Buttons */}
                    {useMobileLayout && (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 2,
                                width: '100%',
                                mt: 1.5,
                            }}
                        >
                            <HintButton
                                onHintRequest={handleHintRequest}
                                remainingHints={allFound ? 0 : remainingHints}
                                isProgressiveMode={true}
                                showHintButton={sessionData?.config?.allow_hints !== false}
                                gameType={gameType}
                                currentHintLevel={currentHintLevel}
                                disabled={allFound}
                                compact
                            />

                            {/* Back Button */}
                            <Tooltip title={t('back_to_game', 'Back to Game')} placement="top" arrow>
                                <Button
                                    variant="contained"
                                    onClick={() => navigate('/')}
                                    aria-label={t('back_to_game', 'Back to Game')}
                                    sx={{
                                        minWidth: '48px',
                                        width: '48px',
                                        height: '48px',
                                        padding: 0,
                                        borderRadius: '12px',
                                        border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        boxShadow: (theme) => `1px 2px 0 ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        background: (theme) => theme.palette.mode === 'dark' ? '#4a4a4a' : '#f9e7b3',
                                        color: (theme) => theme.palette.mode === 'dark' ? '#e0e0e0' : '#333',
                                        '&:hover': {
                                            background: (theme) => theme.palette.mode === 'dark' ? '#5a5a5a' : '#f0d99a',
                                        },
                                    }}
                                >
                                    <ArrowBackIcon />
                                </Button>
                            </Tooltip>

                            {/* Phrase List Button */}
                            <Tooltip title={t('phrases_capitalized', 'Phrases')} placement="top" arrow>
                                <Button
                                    variant="contained"
                                    onClick={() => setMobileSheetOpen(true)}
                                    aria-label={t('show_phrases', 'Show Phrases')}
                                    sx={{
                                        minWidth: '48px',
                                        width: '48px',
                                        height: '48px',
                                        padding: 0,
                                        borderRadius: '12px',
                                        border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        boxShadow: (theme) => `1px 2px 0 ${theme.palette.mode === 'dark' ? '#6b5b3a' : '#b89c4e'}`,
                                        background: (theme) => theme.palette.mode === 'dark' ? '#4a4a4a' : '#f9e7b3',
                                        color: (theme) => theme.palette.mode === 'dark' ? '#e0e0e0' : '#333',
                                        '&:hover': {
                                            background: (theme) => theme.palette.mode === 'dark' ? '#5a5a5a' : '#f0d99a',
                                        },
                                    }}
                                >
                                    <ListIcon />
                                </Button>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Mobile Layout - Bottom Sheet */}
                    {useMobileLayout && (
                        <MobilePhraseListSheet
                            open={mobileSheetOpen}
                            onClose={() => setMobileSheetOpen(false)}
                            phrases={phrases}
                            found={found}
                            hidePhrases={isCrossword ? false : hidePhrases}
                            setHidePhrases={isCrossword ? null : setHidePhrases}
                            allFound={allFound}
                            showTranslations={showTranslationsSetting && (isCrossword || showTranslations)}
                            setShowTranslations={isCrossword ? null : (showTranslationsSetting ? setShowTranslations : null)}
                            disableShowPhrases={isCrossword || false}
                            hideToggleButton={isCrossword}
                            onPhraseClick={handlePhraseClick}
                            progressiveHintsEnabled={false}
                            t={t}
                            gameType={gameType}
                        />
                    )}

                    {/* Actions - Only show Play Again when all found */}
                    {allFound && (
                        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
                            <Button
                                variant="contained"
                                onClick={handleRestart}
                            >
                                {t('play_again', 'Play Again')}
                            </Button>
                        </Stack>
                    )}
                </Stack>

                {/* Translation Input Dialog */}
                <Dialog
                    open={translationDialog.open}
                    onClose={() => { }}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        {t('teacher.puzzle.enter_translation', 'Enter Translation')}
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 2, mt: 1 }}>
                            {t('teacher.puzzle.translate_phrase', 'Translate this phrase:')}
                        </Typography>
                        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
                            {translationDialog.phrase}
                        </Typography>
                        <TextField
                            autoFocus
                            fullWidth
                            label={t('teacher.puzzle.your_translation', 'Your translation')}
                            value={translationInput}
                            onChange={e => setTranslationInput(e.target.value)}
                            onKeyPress={e => {
                                if (e.key === 'Enter' && translationInput.trim()) {
                                    handleTranslationSubmit();
                                }
                            }}
                            inputProps={{ maxLength: 50 }}
                            helperText={`${translationInput.length}/50`}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="contained"
                            onClick={handleTranslationSubmit}
                            disabled={!translationInput.trim()}
                        >
                            {t('submit', 'Submit')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        );
    }

    // Pre-session - show nickname input or logged-in user greeting
    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <Card>
                <CardContent>
                    <Stack spacing={3}>
                        <Typography variant="h4" align="center">
                            {puzzleData?.name || t('teacher.puzzle.title', 'Puzzle')}
                        </Typography>
                        {puzzleData?.description && (
                            <Typography color="text.secondary" align="center">
                                {puzzleData.description}
                            </Typography>
                        )}

                        {checkingAuth ? (
                            <Stack alignItems="center" spacing={2}>
                                <CircularProgress size={24} />
                                <Typography color="text.secondary">
                                    {t('common.checking_auth', 'Checking login status...')}
                                </Typography>
                            </Stack>
                        ) : currentUser ? (
                            // Logged-in user - show greeting and start button
                            <>
                                <Alert severity="success">
                                    {t('teacher.puzzle.welcome_user', { name: currentUser.username || currentUser.display_name, defaultValue: 'Welcome, {{name}}!' })}
                                </Alert>
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={handleStartSession}
                                >
                                    {t('teacher.puzzle.start_puzzle', 'Start Puzzle')}
                                </Button>
                            </>
                        ) : (
                            // Anonymous user - show nickname input
                            <>
                                <Alert severity="info">
                                    {t('teacher.puzzle.enter_nickname', 'Enter your nickname to start the puzzle.')}
                                </Alert>
                                <TextField
                                    label={t('teacher.puzzle.nickname', 'Nickname')}
                                    value={nickname}
                                    onChange={e => setNickname(e.target.value)}
                                    fullWidth
                                    autoFocus
                                    inputProps={{ maxLength: 100 }}
                                    onKeyPress={e => {
                                        if (e.key === 'Enter' && nickname.trim()) {
                                            handleStartSession();
                                        }
                                    }}
                                />
                                <Button
                                    variant="contained"
                                    size="large"
                                    onClick={handleStartSession}
                                    disabled={!nickname.trim()}
                                >
                                    {t('teacher.puzzle.start_puzzle', 'Start Puzzle')}
                                </Button>
                            </>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}

export default TeacherPuzzlePage;
