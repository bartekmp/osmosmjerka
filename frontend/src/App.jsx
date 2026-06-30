import logger from '@shared/utils/logger';
import {
  Box,
  CircularProgress,
  Container,
  CssBaseline,
  ThemeProvider as MUIThemeProvider,
  Typography,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import confetti from "canvas-confetti";
import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes, useLocation, useNavigate, Navigate } from "react-router-dom";
// App component styles
import "./styles/layout/container.css";
import "./styles/features/loading-overlay.css";
import "./styles/features/all-found-message.css";
import "./styles/controls/admin-controls.css";
import "./styles/controls/game-controls.css";
import "./styles/responsive/app-responsive.css";
import { ThemeProvider, useThemeMode } from "./contexts/ThemeContext";
import { AdminControls } from "./features";
import { SplashScreen, WhatsNewModal } from "./shared";
import { GameView } from "./GameView";
import "./style.css";
import createAppTheme from "./theme";

// Import custom hooks
import useCelebration from "./hooks/useCelebration";
import useGameDifficulties from "./hooks/useGameDifficulties";
import useLogoColor from "./hooks/useLogoColor";
import { useDebouncedValue } from "./hooks/useDebounce";
import { useTouchDevice } from "./hooks/useTouchDevice";
import { useScreenTooSmall } from "./hooks/useScreenTooSmall";
import { useGridTooSmall } from "./hooks/useGridTooSmall";
import { useAuth } from "./hooks/useAuth";
import { useSystemPreferences } from "./hooks/useSystemPreferences";
import { useWhatsNew } from "./hooks/useWhatsNew";
import { useGameSession } from "./hooks/useGameSession";
import { useScoring } from "./hooks/useScoring";
import { useCategories } from "./hooks/useCategories";
import { useSplash } from "./hooks/useSplash";

import {
  loadPuzzle as loadPuzzleHelper,
  restoreGameState,
  saveGameState,
} from "./helpers/appHelpers";
import { STORAGE_KEYS } from "./shared/constants/constants";
import { RateLimitWarning } from "./shared/components/ui/RateLimitWarning";
import appVersion from "./version";

// Lazy load admin components
const AdminPanel = lazy(() =>
  import("./features").then((module) => ({ default: module.AdminPanel }))
);
const UserManagement = lazy(() =>
  import("./features").then((module) => ({ default: module.UserManagement }))
);
const UserProfile = lazy(() =>
  import("./features").then((module) => ({ default: module.UserProfile }))
);
const TeacherPuzzlePage = lazy(() =>
  import("./features/teacher").then((module) => ({ default: module.TeacherPuzzlePage }))
);

function AppContent() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const gridRef = useRef(null);
  const { isDarkMode } = useThemeMode();

  // Use custom hooks
  const { logoFilter, setLogoFilter, changeLogoColor } = useLogoColor();
  const { availableDifficulties } = useGameDifficulties();
  const isTouchDevice = useTouchDevice();
  const isScreenTooSmall = useScreenTooSmall();
  const { currentUser, statisticsEnabled } = useAuth();
  const { scoringEnabled, progressiveHintsEnabled } = useSystemPreferences();
  const { showWhatsNew, whatsNewEntries, handleWhatsNewClose } = useWhatsNew();

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLanguageSetId, setSelectedLanguageSetId] = useState(() => {
    // Load from localStorage or default to null
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
    return saved ? parseInt(saved) : null;
  });
  const [selectedPrivateListId, setSelectedPrivateListId] = useState(null);
  const [grid, setGrid] = useState([]);
  const [phrases, setPhrases] = useState([]);
  const [found, setFound] = useState([]);
  const [difficulty, setDifficulty] = useState("easy");
  const [gameType, setGameType] = useState(() => {
    // Initialize game type from URL
    const path = window.location.pathname;
    if (['/crossword', '/crosswords', '/krizaljka', '/k'].includes(path)) {
      return 'crossword';
    }
    // Default or explicit word search paths
    return 'word_search';
  });
  const [hidePhrases, setHidePhrases] = useState(false);
  const [showTranslations, setShowTranslations] = useState(() => {
    const saved = localStorage.getItem("osmosmjerkaGameState");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        return !!state.showTranslations;
      } catch (error) {
        // Ignore parsing errors
        logger.warn("Failed to parse stored game state:", error);
      }
    }
    return false;
  });

  // Layout is purely viewport-width driven (via theme breakpoints) so that narrow
  // non-touch windows get the same comfortable mobile layout as phones instead of
  // a cramped two-column layout. `isTouchDevice` still tunes interaction (cell
  // sizing, FABs) downstream — it just no longer decides the overall layout.
  // md (900px) comfortably fits the grid next to the ~280-320px sidebar.
  // Note: AppContent renders the MUI ThemeProvider in its own return, so it is
  // not itself inside that provider — the string query form is used here (values
  // mirror the theme's md/lg breakpoints) instead of the theme-callback form.
  const showSidebarLayout = useMediaQuery("(min-width:900px)"); // theme md
  const useMobileLayout = !showSidebarLayout;

  // Reactive compact flag for the sidebar (phrase list / hint button); updates on
  // resize, unlike the previous render-time window.innerWidth reads.
  const compactSidebar = useMediaQuery("(max-width:1199.95px)"); // below theme lg

  // Check if grid cells would be too small
  const isGridTooSmall = useGridTooSmall(grid.length, isTouchDevice, useMobileLayout);

  const [restored, setRestored] = useState(false);
  const [notEnoughPhrases, setNotEnoughPhrases] = useState(false);
  const [notEnoughPhrasesMsg, setNotEnoughPhrasesMsg] = useState("");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showRateLimit, setShowRateLimit] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [languageSetsStatus, setLanguageSetsStatus] = useState("pending");
  const [gridStatus, setGridStatus] = useState("pending");

  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const currentElapsedTimeRef = useRef(0);

  // Progressive hint system state
  const [hintsUsed, setHintsUsed] = useState(0);
  const [remainingHints, setRemainingHints] = useState(3);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);

  // Mobile UI state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Debounced language set ID to prevent excessive API calls
  const debouncedLanguageSetId = useDebouncedValue(selectedLanguageSetId, 500);

  // Game session hook
  const {
    gameSessionId,
    gameStartTime,
    setGameStartTime,
    lastFoundCount,
    setLastFoundCount,
    sessionCompleted,
    completionInProgressRef,
    startGameSession,
    updateGameProgress,
    completeGameSession,
    resetSession,
  } = useGameSession({ selectedLanguageSetId, statisticsEnabled });

  // Scoring hook
  const {
    currentScore,
    scoreBreakdown,
    scoringRules,
    scoringRulesStatus,
    setFirstPhraseTime,
    timerResetTrigger,
    loadScoringRules,
    saveGameScore,
    updateScore,
    ensureScoreBreakdownFromApi,
    registerScoreDialogOpener,
    openScoreBreakdownDialog,
    resetScoringState,
  } = useScoring({
    scoringEnabled,
    difficulty,
    phrases,
    found,
    hintsUsed,
    gameSessionId,
    selectedLanguageSetId,
    selectedCategory,
    grid,
    currentElapsedTimeRef,
  });

  const justRestoredRef = useRef(false);

  const handleRateLimit = useCallback(() => {
    setShowRateLimit(true);
    setTimeout(() => setShowRateLimit(false), 4000);
  }, []);

  // Categories hook
  const {
    ignoredCategories,
    userIgnoredCategories,
    categoriesStatus,
    setCategoriesStatus,
    visibleCategories,
    updateUserIgnoredCategories,
  } = useCategories({
    debouncedLanguageSetId,
    selectedPrivateListId,
    restored,
    selectedLanguageSetId,
    selectedCategory,
    hasGrid: grid.length > 0,
    setSelectedCategory,
    setGridStatus,
    onRateLimit: handleRateLimit,
  });

  // Splash / initial load hook
  const { showSplash, initialLoadComplete } = useSplash({
    languageSetsStatus,
    categoriesStatus,
    gridStatus,
    restored,
    isAdminRoute,
  });

  // Winning condition: all phrases found
  const allFound = phrases.length > 0 && found.length === phrases.length;
  const isTimerActive =
    found.length > 0 && !allFound && !isAdminRoute && !isPaused;

  // Use celebration hook
  const { showCelebration, resetCelebration } = useCelebration(
    allFound,
    setLogoFilter
  );

  // Memoized callback for language set changes to prevent unnecessary re-renders
  const handleLanguageSetChange = useCallback((languageSetId) => {
    setSelectedLanguageSetId(languageSetId);
    // Save to localStorage
    localStorage.setItem(
      STORAGE_KEYS.SELECTED_LANGUAGE_SET,
      languageSetId?.toString() || ""
    );
    // Clear current game state when changing language set
    setGrid([]);
    setPhrases([]);
    setFound([]);
    resetSession();
  }, [resetSession]);

  const handleLanguageSetStatusChange = useCallback((status) => {
    setLanguageSetsStatus(status);

    if (status === "empty" || status === "error") {
      setCategoriesStatus((prev) => (prev === "pending" ? status : prev));
      setGridStatus((prev) => (prev === "pending" ? status : prev));
    }
  }, []);

  // Apply theme data attribute to body
  useEffect(() => {
    document.body.setAttribute("data-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Restore state from localStorage on mount, but only if not already won
  useEffect(() => {
    const path = window.location.pathname;
    const isRoot = path === '/' || path === '/index.html';
    // If on a specific game route, enforce that type. If on root, allow any type.
    const requiredType = isRoot ? null : gameType;

    const didRestore = restoreGameState({
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
      setGridStatus,
      setIsPaused,
      setGameType: (type) => {
        // Only update game type state if we're on root
        // If on specific route, we already enforced uniformity via requiredType
        if (isRoot) {
          setGameType(type);
        }
      },
    }, requiredType);

    if (didRestore) {
      justRestoredRef.current = true;
    }
  }, []);



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
      isPaused,
      gameType,
    });
  }, [
    grid,
    phrases,
    found,
    selectedCategory,
    difficulty,
    hidePhrases,
    allFound,
    showTranslations,
    selectedLanguageSetId,
    currentElapsedTime,
    isPaused,
    gameType,
  ]);

  useEffect(() => {
    currentElapsedTimeRef.current = currentElapsedTime;
  }, [currentElapsedTime]);

  useEffect(() => {
    if (!restored) return;

    // If we just restored a valid game state, don't reload the puzzle
    if (justRestoredRef.current) {
      justRestoredRef.current = false;
      // Verify we actually have content before skipping load
      if (grid.length > 0) {
        return;
      }
    }

    // Load puzzle if:
    // 1. A category is selected (for public puzzles), OR
    // 2. A private list is selected (category is optional for private lists)
    if (selectedCategory || selectedPrivateListId) {
      loadPuzzle(selectedCategory, difficulty);
    }
  }, [restored, selectedCategory, difficulty, selectedPrivateListId]);

  const loadPuzzle = (category, diff = difficulty, refresh = false, overrideGameType = null) => {
    setIsGridLoading(true);
    setGridStatus("pending");
    resetCelebration();

    resetSession();
    resetGameState();

    return loadPuzzleHelper(
      category,
      diff,
      {
        setSelectedCategory,
        setGrid,
        setPhrases,
        setFound,
        setHidePhrases,
        setShowTranslations,
        setNotEnoughPhrases,
        setNotEnoughPhrasesMsg,
      },
      t,
      selectedLanguageSetId,
      refresh,
      selectedPrivateListId,
      overrideGameType || gameType
    )
      .then((result) => {
        if (result?.status === "error") {
          setGridStatus("error");
        } else if (result?.status === "empty") {
          setGridStatus("empty");
        } else {
          setGridStatus("success");
        }
      })
      .catch(() => {
        setGridStatus("error");
      })
      .finally(() => {
        setIsGridLoading(false);
      });
  };

  // Create a separate refresh function for clarity
  const refreshPuzzle = (category, diff = difficulty) => {
    loadPuzzle(category, diff, true);
  };


  // Hint system functions
  const handleHintRequest = useCallback(async () => {
    if (remainingHints <= 0 || !gridRef.current) return;

    // For crossword mode, just reveal next character
    // For word search, use progressive hint system if enabled
    const targetPhrase = gridRef.current.showProgressiveHint(progressiveHintsEnabled);
    if (targetPhrase) {
      setRemainingHints((prev) => prev - 1);
      setHintsUsed((prev) => prev + 1);
    }
  }, [remainingHints, progressiveHintsEnabled]);

  const resetGameState = useCallback(() => {
    resetScoringState();
    setHintsUsed(0);
    setRemainingHints(gameType === "crossword" ? phrases.length : 3);
    setCurrentHintLevel(0);
    setCurrentElapsedTime(0);
    currentElapsedTimeRef.current = 0;
    setFound([]);
    setIsPaused(false);

    if (gridRef.current) {
      gridRef.current.clearHints();
    }
  }, [resetScoringState, gameType, phrases.length]);

  // Update hint count when game type changes (without refresh)
  useEffect(() => {
    if (phrases.length > 0 && !isGridLoading) {
      const newHintCount = gameType === "crossword"
        ? phrases.length
        : 3;

      // Only update if hint count should change and we haven't used any hints yet
      if (hintsUsed === 0 && remainingHints !== newHintCount) {
        setRemainingHints(newHintCount);
      }
    }
  }, [gameType, phrases.length, isGridLoading, hintsUsed, remainingHints]);

  const markFound = useCallback(
    (phrase) => {
      // Handle both phrase strings (word search) and phrase objects (crossword)
      // For crossword, phrase is an object with {phrase, translation, coords, ...}
      const phraseText = typeof phrase === 'string' ? phrase : phrase?.phrase;

      // Check if already found by comparing phrase text
      const isAlreadyFound = found.some(f =>
        (typeof f === 'string' ? f : f?.phrase) === phraseText
      );

      if (!isAlreadyFound) {
        const newFoundList = [...found, phrase];
        const newFoundCount = newFoundList.length;

        // Start timer on first found phrase
        if (found.length === 0 && scoringEnabled) {
          const now = new Date().toISOString();
          setFirstPhraseTime(now);
        }

        // Start game session on first found phrase (only if statistics are enabled)
        if (
          found.length === 0 &&
          phrases.length > 0 &&
          grid.length > 0 &&
          selectedCategory &&
          !gameSessionId &&
          !sessionCompleted &&
          statisticsEnabled
        ) {
          const gridSize = grid.length;
          startGameSession(
            selectedCategory,
            difficulty,
            gridSize,
            phrases.length
          );
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
          updateScore(newFoundCount, timePlayed, hintsUsed);
        }
      }
    },
    [
      found,
      phrases.length,
      grid.length,
      selectedCategory,
      gameSessionId,
      sessionCompleted,
      difficulty,
      startGameSession,
      statisticsEnabled,
      scoringEnabled,
      gameStartTime,
      updateGameProgress,
      updateScore,
    ]
  );

  const handlePhraseClick = (phrase) => {
    if (!gridRef.current) return;

    if (gameType === "crossword") {
      // Crossword mode: focus on phrase's first missing cell
      gridRef.current.focusPhrase?.(phrase);
    } else if (!progressiveHintsEnabled) {
      // Word search mode: blink the phrase (only when progressive hints disabled)
      gridRef.current.blinkPhrase?.(phrase);
    }
  };

  // Timer update callback
  const handleTimerUpdate = useCallback(
    (elapsedSeconds) => {
      setCurrentElapsedTime(elapsedSeconds); // Track current elapsed time for saving
      if (scoringEnabled && found.length > 0 && allFound) {
        updateScore(found.length, elapsedSeconds, hintsUsed);
      }
    },
    [scoringEnabled, found.length, allFound, updateScore, hintsUsed]
  );

  const handlePauseToggle = useCallback(() => {
    if (found.length === 0 || allFound) {
      return;
    }
    setIsPaused((prev) => !prev);
  }, [found.length, allFound]);

  const handleGridInteraction = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
    }
  }, [isPaused]);

  useEffect(() => {
    if (allFound) {
      setIsPaused(false);
    }
  }, [allFound]);

  useEffect(() => {
    if (!scoringEnabled || found.length === 0) {
      return;
    }

    updateScore(found.length, currentElapsedTimeRef.current, hintsUsed);
  }, [hintsUsed, scoringEnabled, found.length, updateScore]);

  useEffect(() => {
    if (!scoringEnabled || !allFound) {
      return;
    }

    if (scoreBreakdown) {
      return;
    }

    ensureScoreBreakdownFromApi();
  }, [scoringEnabled, allFound, ensureScoreBreakdownFromApi, scoreBreakdown]);

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
    if (allFound && gameSessionId && gameStartTime && !sessionCompleted) {
      const finish = async () => {
        const durationSeconds = await completeGameSession(found.length, true);
        if (scoringEnabled && durationSeconds != null) {
          await saveGameScore(found.length, durationSeconds, true);
        }
      };
      finish();
    }
  }, [
    allFound,
    gameSessionId,
    gameStartTime,
    sessionCompleted,
    completeGameSession,
    scoringEnabled,
    saveGameScore,
    found.length,
  ]);

  useEffect(() => {
    // Complete session when starting a new game (if there was a previous incomplete session)
    const currentGameSessionId = gameSessionId;
    const currentSessionCompleted = sessionCompleted;
    const currentFoundLength = found.length;

    return () => {
      if (
        currentGameSessionId &&
        !currentSessionCompleted &&
        !completionInProgressRef.current
      ) {
        completeGameSession(currentFoundLength, false);
      }
    };
  }, [selectedCategory, difficulty]); // Only reset when starting new game - intentionally omit completeGameSession to prevent cleanup on every callback recreation

  // Automatically reveal phrases when all are found
  useEffect(() => {
    if (allFound) setHidePhrases(false);
  }, [allFound]);

  const isTeacherPuzzleRoute = location.pathname.startsWith("/t/");
  const shouldShowSplash = !isAdminRoute && !isTeacherPuzzleRoute && showSplash;

  // Auto-adjust difficulty if current one becomes unavailable due to screen size
  React.useEffect(() => {
    const isCurrentDifficultyAvailable = availableDifficulties.some(
      (d) => d.value === difficulty
    );
    if (!isCurrentDifficultyAvailable && availableDifficulties.length > 0) {
      // Switch to the highest available difficulty (last in array)
      setDifficulty(availableDifficulties[availableDifficulties.length - 1].value);
    }
  }, [availableDifficulties, difficulty]);

  const handleGameTypeChange = useCallback((type) => {
    setGameType(type);
    const path = window.location.pathname;
    if (path !== "/" && path !== "/index.html") {
      navigate(type === "crossword" ? "/crosswords" : "/wordsearch");
    }
    loadPuzzle(selectedCategory, difficulty, true, type);
  }, [navigate, selectedCategory, difficulty, loadPuzzle]);

  const gameView = (
    <GameView
      useMobileLayout={useMobileLayout}
      compactSidebar={compactSidebar}
      isDarkMode={isDarkMode}
      isTouchDevice={isTouchDevice}
      isScreenTooSmall={isScreenTooSmall}
      isGridTooSmall={isGridTooSmall}
      logoFilter={logoFilter}
      onLogoClick={changeLogoColor}
      showCelebration={showCelebration}
      onGameTypeChange={handleGameTypeChange}
      gameType={gameType}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      availableDifficulties={availableDifficulties}
      grid={grid}
      phrases={phrases}
      found={found}
      allFound={allFound}
      hidePhrases={hidePhrases}
      setHidePhrases={setHidePhrases}
      showTranslations={showTranslations}
      setShowTranslations={setShowTranslations}
      notEnoughPhrases={notEnoughPhrases}
      notEnoughPhrasesMsg={notEnoughPhrasesMsg}
      isGridLoading={isGridLoading}
      panelOpen={panelOpen}
      setPanelOpen={setPanelOpen}
      visibleCategories={visibleCategories}
      selectedLanguageSetId={selectedLanguageSetId}
      onLanguageSetChange={handleLanguageSetChange}
      onLanguageSetStatusChange={handleLanguageSetStatusChange}
      selectedPrivateListId={selectedPrivateListId}
      setSelectedPrivateListId={setSelectedPrivateListId}
      scoringEnabled={scoringEnabled}
      currentScore={currentScore}
      scoreBreakdown={scoreBreakdown}
      scoringRules={scoringRules}
      scoringRulesStatus={scoringRulesStatus}
      loadScoringRules={loadScoringRules}
      openScoreBreakdownDialog={openScoreBreakdownDialog}
      registerScoreDialogOpener={registerScoreDialogOpener}
      isTimerActive={isTimerActive}
      isPaused={isPaused}
      onPauseToggle={handlePauseToggle}
      onTimerUpdate={handleTimerUpdate}
      currentElapsedTime={currentElapsedTime}
      timerResetTrigger={timerResetTrigger}
      gameStartTime={gameStartTime}
      progressiveHintsEnabled={progressiveHintsEnabled}
      hintsUsed={hintsUsed}
      remainingHints={remainingHints}
      currentHintLevel={currentHintLevel}
      onHintRequest={handleHintRequest}
      gridRef={gridRef}
      onFound={markFound}
      onPhraseClick={handlePhraseClick}
      onGridInteraction={handleGridInteraction}
      loadPuzzle={loadPuzzle}
      refreshPuzzle={refreshPuzzle}
      currentUser={currentUser}
      mobileSheetOpen={mobileSheetOpen}
      setMobileSheetOpen={setMobileSheetOpen}
      t={t}
    />
  );

  return (
    <MUIThemeProvider theme={createAppTheme(isDarkMode)}>
      <CssBaseline />
      {shouldShowSplash && (
        <SplashScreen
          open={!initialLoadComplete}
          messageKey="loading_game"
          isDarkMode={isDarkMode}
          exitDuration={600}
        />
      )}
      <Container
        maxWidth="xl"
        sx={{
          minHeight: "100vh",
          py: useMobileLayout ? 0.125 : 2, // 1px on mobile (0.125 * 8px = 1px), 16px on desktop
          px: useMobileLayout ? 0.125 : 2, // 1px horizontal padding on mobile
          position: "relative"
        }}
      >
        {/* Top controls row for admin routes only */}
        {isAdminRoute && <AdminControls />}

        <Routes>
          <Route
            path="/admin"
            element={
              <Suspense fallback={<CircularProgress />}>
                <AdminPanel
                  ignoredCategories={ignoredCategories}
                  userIgnoredCategories={userIgnoredCategories}
                  onUpdateUserIgnoredCategories={updateUserIgnoredCategories}
                />
              </Suspense>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Suspense fallback={<CircularProgress />}>
                <UserManagement />
              </Suspense>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <Suspense fallback={<CircularProgress />}>
                <UserProfile />
              </Suspense>
            }
          />
          <Route
            path="/t/:token"
            element={
              <Suspense fallback={<CircularProgress />}>
                <TeacherPuzzlePage />
              </Suspense>
            }
          />
          {/* Game Routes */}
          {/* Root now keeps SPA behavior with state-based game type */}
          <Route path="/" element={gameView} />

          {/* Canonical Word Search Route */}
          <Route path="/wordsearch" element={gameView} />

          {/* Word Search Aliases (Redirects) */}
          <Route path="/osmosmjerka" element={<Navigate to="/wordsearch" replace />} />
          <Route path="/o" element={<Navigate to="/wordsearch" replace />} />

          {/* Canonical Crossword Route */}
          <Route path="/crosswords" element={gameView} />

          {/* Crossword Aliases (Redirects) */}
          <Route path="/crossword" element={<Navigate to="/crosswords" replace />} />
          <Route path="/krizaljka" element={<Navigate to="/crosswords" replace />} />
          <Route path="/k" element={<Navigate to="/crosswords" replace />} />
        </Routes >

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            mt: 4,
            py: 3,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: useMobileLayout ? "flex-end" : "center",
            gap: 2,
            px: 2,
          }}
        >
          {!useMobileLayout && (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                component="a"
                href={`https://github.com/bartekmp/osmosmjerka/releases/tag/v${appVersion}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  textDecoration: "none",
                  color: "text.secondary",
                  "&:hover": {
                    textDecoration: "underline",
                    color: "primary.main",
                  },
                }}
              >
                Osmosmjerka v{appVersion}
              </Typography>
              <Box sx={{ height: 20, width: 1, bgcolor: "divider" }} />
            </>
          )}
          <IconButton
            size="small"
            href="https://github.com/bartekmp/osmosmjerka"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: "text.secondary" }}
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
        message={
          t(
            "common.rateLimitWarning",
            "Please wait before making another request. The server is processing your previous request."
          )
        }
      />

      {/* What's New Modal */}
      <WhatsNewModal
        open={showWhatsNew}
        onClose={handleWhatsNewClose}
        entries={whatsNewEntries}
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
