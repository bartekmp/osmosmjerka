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
import TrainingConfidencePrompt from "./features/game/components/Training/TrainingConfidencePrompt";
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
import { useMasteryStats } from "./hooks/useMasteryStats";
import { useTraining } from "./hooks/useTraining";
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
const ReviewSprint = lazy(() =>
  import("./features/game/components/Review/ReviewSprint").then((module) => ({ default: module.default }))
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
  const { progressiveHintsEnabled } = useSystemPreferences();
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
  // Crossword forfeit: the player gave up, answers were revealed, game is over-but-not-won.
  const [forfeited, setForfeited] = useState(false);
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
  // Bumped on every new game so the Timer resets even though it isn't remounted.
  const [timerResetTrigger, setTimerResetTrigger] = useState(0);

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

  const justRestoredRef = useRef(false);

  // Recall/rating (spaced-repetition): rate recall after each found/solved word.
  // Always active for logged-in users; guests keep the casual, untracked experience.
  const { enqueueForRating, submitRating, currentRating } = useTraining({
    selectedLanguageSetId,
    gameType,
  });

  // Mastery/streak summary chip on the main game screen (logged-in users only).
  const { stats: masteryStats, refreshStats: refreshMasteryStats } = useMasteryStats({
    currentUser,
    languageSetId: selectedLanguageSetId,
  });
  const handleSubmitRating = useCallback(
    (grade) => {
      submitRating(grade);
      // The review POST is fire-and-forget; give it a moment before refetching.
      setTimeout(refreshMasteryStats, 400);
    },
    [submitRating, refreshMasteryStats]
  );

  // Winning condition: all phrases found (also gates the recall-hiding peek below).
  const allFound = phrases.length > 0 && found.length === phrases.length;

  // For logged-in users in word-search, translations stay hidden DURING play so each
  // find is a real recall event. Once the game is finished (allFound) the player may
  // peek — the toggle reappears and its state is honored again. Crossword keeps its
  // normal behavior. Guests never get this hiding (they have no account to track
  // mastery/streak against, so casual play stays as-is).
  const effectiveShowTranslations =
    !!currentUser && gameType !== "crossword" && !allFound ? false : showTranslations;

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
    setForfeited(false);
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
    setHintsUsed(0);
    setRemainingHints(gameType === "crossword" ? phrases.length : 3);
    setCurrentHintLevel(0);
    setCurrentElapsedTime(0);
    setTimerResetTrigger((prev) => prev + 1);
    setFound([]);
    setForfeited(false);
    setIsPaused(false);

    if (gridRef.current) {
      gridRef.current.clearHints();
    }
  }, [gameType, phrases.length]);

  // Give up on a crossword: reveal every answer and put the game into a finished state
  // without crediting the unsolved phrases (no score / no mastery updates).
  const handleForfeit = useCallback(() => {
    if (gridRef.current?.revealAll) {
      gridRef.current.revealAll();
    }
    setForfeited(true);
    setHidePhrases(false);
    setShowTranslations(true);
  }, []);

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

        // Logged-in users: queue this word for a confidence rating, feeding mastery
        // and the daily streak. Word search stores phrase strings, so resolve to the
        // full object (id + translation) from `phrases`. Guests have no account to
        // track this against, so they skip the rating queue entirely.
        if (currentUser) {
          const phraseObj =
            typeof phrase === "string" ? phrases.find((p) => p.phrase === phrase) : phrase;
          if (phraseObj?.id != null) {
            enqueueForRating({
              id: phraseObj.id,
              phrase: phraseObj.phrase,
              translation: phraseObj.translation,
            });
          }
        }

        // Clear any active hints when phrase is found
        if (gridRef.current) {
          gridRef.current.clearHints();
        }
        setCurrentHintLevel(0);

        // Update progress tracking
        updateGameProgress(newFoundCount);
      }
    },
    [
      found,
      phrases,
      grid.length,
      selectedCategory,
      gameSessionId,
      sessionCompleted,
      difficulty,
      startGameSession,
      statisticsEnabled,
      updateGameProgress,
      currentUser,
      enqueueForRating,
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
  const handleTimerUpdate = useCallback((elapsedSeconds) => {
    setCurrentElapsedTime(elapsedSeconds); // Track current elapsed time for saving
  }, []);

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
      completeGameSession(found.length, true);
    }
  }, [allFound, gameSessionId, gameStartTime, sessionCompleted, completeGameSession, found.length]);

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

  // The splash is driven by puzzle load, so it only belongs on the main game pages.
  // Everywhere else (admin, teacher puzzle, review/learn, etc.) it would either never
  // dismiss or just get in the way, so restrict it to the game routes explicitly.
  const GAME_ROUTES = ["/", "/wordsearch", "/crosswords"];
  const isGameRoute = GAME_ROUTES.includes(location.pathname);
  const shouldShowSplash = isGameRoute && showSplash;

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
      showTranslations={effectiveShowTranslations}
      setShowTranslations={setShowTranslations}
      onOpenReview={() => navigate("/review")}
      masteryStats={masteryStats}
      forfeited={forfeited}
      onForfeit={handleForfeit}
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
      isTimerActive={isTimerActive}
      isPaused={isPaused}
      onPauseToggle={handlePauseToggle}
      onTimerUpdate={handleTimerUpdate}
      currentElapsedTime={currentElapsedTime}
      timerResetTrigger={timerResetTrigger}
      gameStartTime={gameStartTime}
      progressiveHintsEnabled={progressiveHintsEnabled}
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
          {/* Spaced-repetition review sprint */}
          <Route
            path="/review"
            element={
              <Suspense fallback={<CircularProgress />}>
                <ReviewSprint />
              </Suspense>
            }
          />
          <Route path="/learn" element={<Navigate to="/review" replace />} />
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
              fontSize: useMobileLayout ? "0.75rem" : undefined,
              "&:hover": {
                textDecoration: "underline",
                color: "primary.main",
              },
            }}
          >
            Osmosmjerka v{appVersion}
          </Typography>
          <Box sx={{ height: 20, width: 1, bgcolor: "divider" }} />
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

      {/* Training mode: rate recall after each found/solved word */}
      <TrainingConfidencePrompt item={currentRating} onRate={handleSubmitRating} t={t} />
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
