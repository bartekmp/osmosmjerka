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
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import ScrabbleGrid from '../../game/components/Grid/Grid';
import PhraseList from '../../game/components/PhraseList/PhraseList';
import { Timer } from '../../game/components/Timer';
import { useThemeMode } from '../../../contexts/ThemeContext';

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

    // Translation input state
    const [translationDialog, setTranslationDialog] = useState({ open: false, phrase: null });
    const [translationInput, setTranslationInput] = useState('');
    const [translationSubmissions, setTranslationSubmissions] = useState([]);

    const gridRef = useRef(null);
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
                const response = await fetch('/api/user/profile', {
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
            const response = await fetch(`/admin/teacher/set/${token}`);
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
    const markFound = useCallback((phrase) => {
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
                completeSession(newFound.length);
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
        const isCorrect = phraseData &&
            translationInput.trim().toLowerCase() === phraseData.translation?.trim().toLowerCase();

        // Store the submission
        setTranslationSubmissions(prev => [...prev, {
            phrase,
            submitted: translationInput.trim(),
            correct: phraseData?.translation || '',
            is_correct: isCorrect,
        }]);

        // Close dialog and mark as found
        setTranslationDialog({ open: false, phrase: null });
        setTranslationInput('');
        markFound(phrase);
    }, [translationDialog.phrase, translationInput, phrases, markFound]);

    // Complete session
    const completeSession = async (phrasesFound) => {
        if (!sessionData?.session_token) return;

        try {
            await fetch(`/admin/teacher/set/${token}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: sessionData.session_token,
                    phrases_found: phrasesFound,
                    duration_seconds: currentElapsedTime,
                    translation_submissions: translationSubmissions.length > 0 ? translationSubmissions : undefined,
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
        // Hide translations if require_translation_input is enabled (to prevent cheating)
        const showTranslationsSetting = !requireTranslationInput && sessionData?.config?.show_translations !== false;

        return (
            <Container maxWidth="lg" sx={{ py: 2 }}>
                <Stack spacing={2}>
                    {/* Header */}
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5">
                            {sessionData?.puzzleName || t('teacher.puzzle.title', 'Puzzle')}
                        </Typography>
                        {showTimer && (
                            <Timer
                                isActive={!allFound && gameStartTime !== null}
                                onTimeUpdate={handleTimerUpdate}
                                startTime={gameStartTime}
                                showTimer={true}
                                currentElapsedTime={currentElapsedTime}
                            />
                        )}
                    </Box>

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
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 3,
                            justifyContent: 'center',
                            alignItems: { xs: 'center', md: 'flex-start' },
                        }}
                    >
                        {/* Grid */}
                        <Box>
                            <ScrabbleGrid
                                ref={gridRef}
                                grid={grid}
                                phrases={phrases}
                                found={found}
                                onFound={handlePhraseFound}
                                disabled={allFound || translationDialog.open}
                                isDarkMode={isDarkMode}
                                showCelebration={allFound}
                            />
                        </Box>

                        {/* Phrase list */}
                        <Box sx={{ width: { xs: '100%', md: 280 } }}>
                            <PhraseList
                                phrases={phrases}
                                found={found}
                                hidePhrases={hidePhrases}
                                setHidePhrases={setHidePhrases}
                                allFound={allFound}
                                showTranslations={showTranslationsSetting && showTranslations}
                                setShowTranslations={showTranslationsSetting ? setShowTranslations : null}
                                disableShowPhrases={false}
                                onPhraseClick={handlePhraseClick}
                                progressiveHintsEnabled={false}
                                t={t}
                            />
                        </Box>
                    </Box>

                    {/* Actions */}
                    <Stack direction="row" spacing={2} justifyContent="center">
                        {allFound && (
                            <Button
                                variant="contained"
                                onClick={handleRestart}
                            >
                                {t('play_again', 'Play Again')}
                            </Button>
                        )}
                        <Button
                            variant="outlined"
                            onClick={() => navigate('/')}
                        >
                            {t('back_to_game', 'Back to Game')}
                        </Button>
                    </Stack>
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
