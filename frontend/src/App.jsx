import {
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  ThemeProvider as MUIThemeProvider,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import axios from "axios";
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
// Mobile component styles
import "./features/game/components/MobilePhraseListSheet/MobilePhraseListSheet.css";
import "./features/game/components/MobileFloatingActions/MobileFloatingActions.css";
import { ThemeProvider, useThemeMode } from "./contexts/ThemeContext";
import {
  AdminControls,
  AllFoundMessage,
  GameControls,
  GameHeader,
  LoadingOverlay,
  PhraseList,
  ScrabbleGrid,
  CrosswordGrid,
  Timer,
  ScoreDisplay,
  HintButton,
  MobilePhraseListSheet,
  MobileFloatingActions,
} from "./features";
import { NotEnoughPhrasesOverlay, ScreenTooSmallOverlay, SplashScreen, WhatsNewModal, CookieConsentBar } from "./shared";
import {
  getLastSeenVersion,
  setLastSeenVersion,
  isNewerVersion,
  fetchWhatsNew,
  getCurrentVersion,
} from "./shared/utils/versionUtils";
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

import {
  loadPuzzle as loadPuzzleHelper,
  restoreGameState,
  saveGameState,
} from "./helpers/appHelpers";
import { API_ENDPOINTS, STORAGE_KEYS } from "./shared/constants/constants";
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

const SPLASH_EXIT_DURATION = 600;
const SPLASH_MIN_VISIBLE_DURATION = 1200;

const DEFAULT_SCORING_RULES = {
  base_points_per_phrase: 100,
  completion_bonus_points: 200,
  difficulty_multipliers: {
    very_easy: 0.9,
    easy: 1.0,
    medium: 1.2,
    hard: 1.5,
    very_hard: 2.0,
  },
  hint_penalty_per_hint: 75,
  time_bonus: {
    max_ratio: 0.3,
    target_times_seconds: {
      very_easy: 240,
      easy: 300,
      medium: 600,
      hard: 900,
      very_hard: 1200,
    },
  },
};

/**
 * Client-side score calculation for anonymous users
 * Mirrors the backend calculation logic exactly
 */
function calculateScoreClientSide(
  difficulty,
  phrasesFound,
  totalPhrases,
  durationSeconds,
  hintsUsed,
  rules = DEFAULT_SCORING_RULES
) {
  const scoringRules = rules || DEFAULT_SCORING_RULES;

  // Base score: constant points per phrase found
  const baseScore = phrasesFound * scoringRules.base_points_per_phrase;

  // Difficulty multipliers determine the size of the bonus
  const difficultyMultiplier =
    scoringRules.difficulty_multipliers[difficulty] ||
    scoringRules.difficulty_multipliers.easy;
  const difficultyBonus = Math.floor(baseScore * (difficultyMultiplier - 1.0));

  // Time bonus (faster completion = higher bonus)
  let timeBonus = 0;
  if (phrasesFound === totalPhrases && durationSeconds > 0) {
    const targetTime =
      scoringRules.time_bonus.target_times_seconds[difficulty] ||
      scoringRules.time_bonus.target_times_seconds.medium;
    if (targetTime > 0 && durationSeconds <= targetTime) {
      const timeRatio = Math.max(
        0.0,
        (targetTime - durationSeconds) / targetTime
      );
      timeBonus = Math.floor(
        baseScore * scoringRules.time_bonus.max_ratio * timeRatio
      );
    }
  }

  // Completion bonus for finding all phrases
  const streakBonus =
    phrasesFound === totalPhrases ? scoringRules.completion_bonus_points : 0;

  // Hint penalty: fixed deduction per hint used
  const hintPenalty = hintsUsed * scoringRules.hint_penalty_per_hint;

  // Calculate final score
  const finalScore = Math.max(
    0,
    baseScore + difficultyBonus + timeBonus + streakBonus - hintPenalty
  );

  return {
    base_score: baseScore,
    difficulty_bonus: difficultyBonus,
    time_bonus: timeBonus,
    streak_bonus: streakBonus,
    hint_penalty: hintPenalty,
    final_score: finalScore,
    hints_used: hintsUsed,
    hint_penalty_per_hint: scoringRules.hint_penalty_per_hint,
  };
}

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

  const [categories, setCategories] = useState([]);
  const [ignoredCategories, setIgnoredCategories] = useState([]);
  const [userIgnoredCategories, setUserIgnoredCategories] = useState([]);
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
        console.warn("Failed to parse stored game state:", error);
      }
    }
    return false;
  });

  // Calculate if there's enough space for sidebar next to grid
  const [showSidebarLayout, setShowSidebarLayout] = useState(false);

  useEffect(() => {
    const calculateLayout = () => {
      const screenWidth = window.innerWidth;

      // Calculate if sidebar can fit next to grid
      if (isTouchDevice && grid.length > 0) {
        // Use a more conservative threshold that accounts for actual rendered grid size
        // For touch devices, we need at least 900px to comfortably fit grid + sidebar
        // This prevents the awkward gap between 690-900px
        const minRequiredWidth = 900;
        setShowSidebarLayout(screenWidth >= minRequiredWidth);
      } else {
        setShowSidebarLayout(screenWidth >= 1200);
      }
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);
  }, [isTouchDevice, grid.length]);

  // Use mobile layout only if touch device AND not enough space for sidebar
  const useMobileLayout = isTouchDevice && !showSidebarLayout;

  // Check if grid cells would be too small
  const isGridTooSmall = useGridTooSmall(grid.length, isTouchDevice, useMobileLayout);

  const [restored, setRestored] = useState(false);
  const [notEnoughPhrases, setNotEnoughPhrases] = useState(false);
  const [notEnoughPhrasesMsg, setNotEnoughPhrasesMsg] = useState("");
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showRateLimit, setShowRateLimit] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  const [languageSetsStatus, setLanguageSetsStatus] = useState("pending");
  const [categoriesStatus, setCategoriesStatus] = useState("pending");
  const [gridStatus, setGridStatus] = useState("pending");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Game session tracking for statistics
  const [gameSessionId, setGameSessionId] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0); // Track current elapsed time for saving
  const currentElapsedTimeRef = useRef(0);
  const [lastFoundCount, setLastFoundCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [statisticsEnabled, setStatisticsEnabled] = useState(true); // Default to true, will be checked from server

  // Scoring system state
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [currentScore, setCurrentScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [scoringRules, setScoringRules] = useState(null);
  const [scoringRulesStatus, setScoringRulesStatus] = useState("idle");
  const [firstPhraseTime, setFirstPhraseTime] = useState(null);
  const [timerResetTrigger, setTimerResetTrigger] = useState(0);
  const scoreDialogOpenerRef = useRef(null);

  // Progressive hint system state
  const [progressiveHintsEnabled, setProgressiveHintsEnabled] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [remainingHints, setRemainingHints] = useState(3);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);

  // Mobile UI state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // What's New modal state
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewEntries, setWhatsNewEntries] = useState([]);

  // Debounced language set ID to prevent excessive API calls
  const debouncedLanguageSetId = useDebouncedValue(selectedLanguageSetId, 500);

  // Refs to prevent duplicate API calls in StrictMode
  const lastFetchedLanguageSetIdRef = useRef(null);
  const completionInProgressRef = useRef(false);
  const splashShownAtRef = useRef(Date.now());

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

    // Reset session tracking state when changing language set
    setSessionCompleted(false);
    setGameSessionId(null);
    setGameStartTime(null);
    setLastFoundCount(0);
  }, []);

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
      setGridStatus,
      setIsPaused,
      setGameType,
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
    axios
      .get(
        `${API_ENDPOINTS.DEFAULT_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`
      )
      .then((res) => setIgnoredCategories(res.data))
      .catch((err) => {
        setIgnoredCategories([]);
        if (err.response?.status === 429) {
          setShowRateLimit(true);
          setTimeout(() => setShowRateLimit(false), 4000);
        }
      });

    // Load user-specific ignored categories
    const token = localStorage.getItem("adminToken"); // reuse admin token if logged in
    axios
      .get(
        `${API_ENDPOINTS.USER_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      .then((res) => setUserIgnoredCategories(res.data))
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

    // Skip if a private list is selected - categories will be loaded by the private list effect
    if (selectedPrivateListId) return;

    // Prevent duplicate API calls for the same language set
    if (lastFetchedLanguageSetIdRef.current === debouncedLanguageSetId) return;
    lastFetchedLanguageSetIdRef.current = debouncedLanguageSetId;

    // Load categories with language set parameter
    let categoriesUrl = API_ENDPOINTS.CATEGORIES;
    if (debouncedLanguageSetId) {
      categoriesUrl += `?language_set_id=${debouncedLanguageSetId}`;
    }

    setCategoriesStatus("pending");
    axios
      .get(categoriesUrl)
      .then((res) => {
        const publicCategories = res.data || [];
        // Add "ALL" option at the beginning for public categories
        const categoriesWithAll = ["ALL", ...publicCategories];
        setCategories(categoriesWithAll);
        if (publicCategories.length === 0) {
          setCategoriesStatus("empty");
          setGridStatus("empty");
          return;
        }
        setCategoriesStatus("success");
        // Automatically select a random category if none is selected and no game is loaded
        if (publicCategories.length > 0 && !selectedCategory && grid.length === 0) {
          const randomIndex = Math.floor(Math.random() * publicCategories.length);
          const randomCategory = publicCategories[randomIndex];
          setSelectedCategory(randomCategory);
          // Automatically load puzzle with the selected category
          loadPuzzle(randomCategory, difficulty);
        }
      })
      .catch((err) => {
        console.error("Error loading categories:", err);
        setCategoriesStatus("error");
        setGridStatus("error");
        if (err.response?.status === 429) {
          setShowRateLimit(true);
          setTimeout(() => setShowRateLimit(false), 4000);
        }
        lastFetchedLanguageSetIdRef.current = null; // Reset on error to allow retry
      });
  }, [restored, debouncedLanguageSetId, selectedPrivateListId]);

  // Fetch categories when private list selection changes
  useEffect(() => {
    if (!restored || !selectedLanguageSetId) return;

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

    if (selectedPrivateListId) {
      // Fetch categories from the private list
      setCategoriesStatus("pending");
      axios
        .get(`/api/user/private-lists/${selectedPrivateListId}/categories?language_set_id=${selectedLanguageSetId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        .then((res) => {
          const listCategories = res.data || [];
          // Add "ALL" option at the beginning for private lists
          const categoriesWithAll = ["ALL", ...listCategories];
          setCategories(categoriesWithAll);
          if (listCategories.length === 0) {
            setCategoriesStatus("empty");
          } else {
            setCategoriesStatus("success");
            // Clear selected category if it doesn't exist in the new list (but keep "ALL" if selected)
            if (selectedCategory && selectedCategory !== "ALL" && !listCategories.includes(selectedCategory)) {
              setSelectedCategory("");
            }
          }
        })
        .catch((err) => {
          console.error("Error loading categories from private list:", err);
          setCategoriesStatus("error");
          setCategories([]);
        });
    } else {
      // When switching back to public, reset the last fetched language set ID
      // so the public categories effect can fetch them
      lastFetchedLanguageSetIdRef.current = null;
    }
  }, [restored, selectedPrivateListId, selectedLanguageSetId]);

  useEffect(() => {
    if (initialLoadComplete || !restored) {
      return;
    }

    const statuses = [languageSetsStatus, categoriesStatus, gridStatus];
    const isWaiting = statuses.some((status) => status === "pending");

    if (isWaiting) {
      return;
    }

    const elapsed = Date.now() - splashShownAtRef.current;
    if (elapsed >= SPLASH_MIN_VISIBLE_DURATION) {
      setInitialLoadComplete(true);
      return;
    }

    const timeout = setTimeout(
      () => setInitialLoadComplete(true),
      SPLASH_MIN_VISIBLE_DURATION - elapsed
    );
    return () => clearTimeout(timeout);
  }, [
    languageSetsStatus,
    categoriesStatus,
    gridStatus,
    initialLoadComplete,
    restored,
  ]);

  useEffect(() => {
    if (isAdminRoute) {
      if (showSplash) {
        setShowSplash(false);
      }
      return;
    }

    if (!restored || !initialLoadComplete) {
      if (!showSplash) {
        splashShownAtRef.current = Date.now();
      }
      setShowSplash(true);
      return;
    }

    const timeout = setTimeout(
      () => setShowSplash(false),
      SPLASH_EXIT_DURATION
    );
    return () => clearTimeout(timeout);
  }, [initialLoadComplete, isAdminRoute, restored, showSplash]);

  const fetchAuthenticatedUser = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

    if (!token) {
      setCurrentUser(null);
      return null;
    }

    try {
      const profileResponse = await axios.get(`${API_ENDPOINTS.USER_PROFILE}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!profileResponse.data) {
        setCurrentUser(null);
        return null;
      }

      setCurrentUser(profileResponse.data);
      return profileResponse.data;
    } catch (error) {
      console.warn("Failed to load authenticated user profile:", error);
      setCurrentUser(null);
      return null;
    }
  }, []);

  // Check if statistics are enabled on the server
  const checkStatisticsEnabled = useCallback(async () => {
    const userProfile = await fetchAuthenticatedUser();
    if (!userProfile) {
      setStatisticsEnabled(false);
      return;
    }

    // For all users, enable statistics by default
    setStatisticsEnabled(true);

    // If user is root admin, check if statistics are explicitly disabled on server
    if (userProfile.role === "root_admin") {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) {
        return;
      }

      try {
        const response = await axios.get(
          `${API_ENDPOINTS.ADMIN}/settings/statistics-enabled`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        // Only disable if explicitly set to false
        if (response.data.enabled === false) {
          setStatisticsEnabled(false);
        }
      } catch (_settingsError) {
        // If settings endpoint fails, keep statistics enabled (default behavior)
        console.warn("Failed to load statistics settings:", _settingsError);
      }
    }
  }, [fetchAuthenticatedUser]);

  // Check scoring and hint preferences
  const checkUserPreferences = useCallback(async () => {
    try {
      // Check system-wide scoring preference (public endpoint)
      const scoringResponse = await axios.get(
        `${API_ENDPOINTS.GAME}/system/scoring-enabled`
      );
      setScoringEnabled(scoringResponse.data.enabled);

      // Check system-wide progressive hints preference (public endpoint)
      const hintsResponse = await axios.get(
        `${API_ENDPOINTS.GAME}/system/progressive-hints-enabled`
      );
      setProgressiveHintsEnabled(hintsResponse.data.enabled);
    } catch (error) {
      console.error("Failed to check system preferences:", error);
      setScoringEnabled(true);
      setProgressiveHintsEnabled(false);
    }
  }, []);

  const loadScoringRules = useCallback(
    async ({ force = false } = {}) => {
      if (!force && scoringRulesStatus === "loading") {
        return;
      }

      setScoringRulesStatus("loading");
      try {
        const response = await axios.get(
          `${API_ENDPOINTS.GAME}/system/scoring-rules`
        );
        setScoringRules(response.data);
        setScoringRulesStatus("loaded");
      } catch (error) {
        console.error("Failed to load scoring rules:", error);
        setScoringRulesStatus("error");
      }
    },
    [scoringRulesStatus]
  );

  // Check statistics enabled status on component mount and when auth changes
  useEffect(() => {
    checkStatisticsEnabled();
  }, [checkStatisticsEnabled]);

  // Check preferences on mount and auth changes
  useEffect(() => {
    checkUserPreferences();
  }, [checkUserPreferences]);

  useEffect(() => {
    const handleAuthChanged = () => {
      checkStatisticsEnabled();
      checkUserPreferences();
    };

    window.addEventListener("admin-auth-changed", handleAuthChanged);
    return () =>
      window.removeEventListener("admin-auth-changed", handleAuthChanged);
  }, [checkStatisticsEnabled, checkUserPreferences]);

  // Check for new version and show What's New modal for logged-in users
  const checkWhatsNew = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return; // Only show for logged-in users

    try {
      const currentVersion = await getCurrentVersion();
      if (!currentVersion) return;

      const lastSeenVersion = getLastSeenVersion();

      if (isNewerVersion(currentVersion, lastSeenVersion)) {
        const entries = await fetchWhatsNew(lastSeenVersion, 5);
        if (entries && entries.length > 0) {
          setWhatsNewEntries(entries);
          setShowWhatsNew(true);
        } else {
          // No changelog entries but version is newer, still update last seen
          setLastSeenVersion(currentVersion);
        }
      }
    } catch (error) {
      console.warn("Failed to check for updates:", error);
    }
  }, []);

  // Handle What's New modal close
  const handleWhatsNewClose = useCallback(async () => {
    setShowWhatsNew(false);
    // Save the current version when user dismisses
    const currentVersion = await getCurrentVersion();
    if (currentVersion) {
      setLastSeenVersion(currentVersion);
    }
  }, []);

  // Check for new version on mount and when auth changes
  useEffect(() => {
    checkWhatsNew();
  }, [checkWhatsNew]);

  useEffect(() => {
    const handleAuthChanged = () => {
      // Small delay to ensure token is saved before checking
      setTimeout(checkWhatsNew, 500);
    };

    window.addEventListener("admin-auth-changed", handleAuthChanged);
    return () =>
      window.removeEventListener("admin-auth-changed", handleAuthChanged);
  }, [checkWhatsNew]);

  useEffect(() => {
    if (!scoringEnabled) {
      return;
    }

    if (
      scoringRulesStatus === "idle" ||
      (scoringRulesStatus === "error" && !scoringRules)
    ) {
      loadScoringRules();
    }
  }, [loadScoringRules, scoringEnabled, scoringRules, scoringRulesStatus]);

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
    currentElapsedTime,
    isPaused,
    gameType,
  ]);

  useEffect(() => {
    currentElapsedTimeRef.current = currentElapsedTime;
  }, [currentElapsedTime]);

  useEffect(() => {
    if (!restored) return;
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
    resetCelebration(); // Reset celebration state using hook

    // Reset session tracking state when loading a new puzzle
    setSessionCompleted(false);
    setGameSessionId(null);
    setGameStartTime(null);
    setLastFoundCount(0);
    completionInProgressRef.current = false; // Reset completion flag for new puzzle

    // Reset scoring and hint state
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

  // Game session tracking functions
  const startGameSession = useCallback(
    async (category, difficulty, gridSize, totalPhrases) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token || !selectedLanguageSetId || !statisticsEnabled) {
        return;
      }

      try {
        const response = await axios.post(
          `${API_ENDPOINTS.GAME}/game/start`,
          {
            language_set_id: selectedLanguageSetId,
            category,
            difficulty,
            grid_size: gridSize,
            total_phrases: totalPhrases,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setGameSessionId(response.data.session_id);
        // Only set gameStartTime if not already set (for restored games)
        if (!gameStartTime) {
          setGameStartTime(Date.now());
        }
        setLastFoundCount(0);
        setSessionCompleted(false);
        completionInProgressRef.current = false; // Reset completion flag for new session
      } catch (error) {
        console.error("Failed to start game session:", error);
      }
    },
    [selectedLanguageSetId, statisticsEnabled, gameStartTime]
  );

  const updateGameProgress = useCallback(
    async (phrasesFound) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token || !gameSessionId || !statisticsEnabled) {
        return;
      }

      try {
        await axios.put(
          `${API_ENDPOINTS.GAME}/game/progress`,
          {
            session_id: gameSessionId,
            phrases_found: phrasesFound,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        console.error("Failed to update game progress:", error);
      }
    },
    [gameSessionId, statisticsEnabled]
  );

  const saveGameScore = useCallback(
    async (phrasesFound, durationSeconds, isCompleted) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token || !gameSessionId || !scoringEnabled) return;

      try {
        const completionTime = isCompleted ? new Date().toISOString() : null;

        const response = await axios.post(
          `${API_ENDPOINTS.GAME}/game/score`,
          {
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
            completion_time: completionTime,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const scoringDetails = response?.data?.scoring_details;
        if (scoringDetails) {
          const totalFoundPhrases = found.length;
          const basePointsPerPhrase =
            scoringRules?.base_points_per_phrase ??
            (totalFoundPhrases > 0
              ? Math.round(scoringDetails.base_score / totalFoundPhrases)
              : 0);
          const perPhraseBreakdown = isCompleted
            ? found.map((phraseText, index) => ({
              id: `${index}-${phraseText}`,
              phrase: phraseText,
              points: basePointsPerPhrase,
            }))
            : [];

          setScoreBreakdown({
            ...scoringDetails,
            per_phrase: perPhraseBreakdown,
            hints_used: hintsUsed,
            hint_penalty_per_hint:
              scoringRules?.hint_penalty_per_hint ??
              DEFAULT_SCORING_RULES.hint_penalty_per_hint,
            duration_seconds: durationSeconds,
            difficulty,
            total_phrases: phrases.length,
            phrases_found: totalFoundPhrases,
            source: "final",
          });

          setCurrentScore(scoringDetails.final_score);
        }
      } catch (error) {
        console.error("Failed to save game score:", error);
      }
    },
    [
      gameSessionId,
      scoringEnabled,
      selectedLanguageSetId,
      selectedCategory,
      difficulty,
      grid.length,
      phrases.length,
      hintsUsed,
      firstPhraseTime,
      found,
      scoringRules,
    ]
  );

  const registerScoreDialogOpener = useCallback((fn) => {
    scoreDialogOpenerRef.current = typeof fn === "function" ? fn : null;
  }, []);

  const openScoreBreakdownDialog = useCallback(() => {
    if (scoreDialogOpenerRef.current) {
      scoreDialogOpenerRef.current();
    }
  }, []);

  const completeGameSession = useCallback(
    async (phrasesFound, isCompleted) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (
        !token ||
        !gameSessionId ||
        !gameStartTime ||
        sessionCompleted ||
        completionInProgressRef.current ||
        !statisticsEnabled
      ) {
        return;
      }

      // Set flag to prevent duplicate calls
      completionInProgressRef.current = true;

      try {
        const durationSeconds = Math.floor((Date.now() - gameStartTime) / 1000);

        await axios.post(
          `${API_ENDPOINTS.GAME}/game/complete`,
          {
            session_id: gameSessionId,
            phrases_found: phrasesFound,
            duration_seconds: durationSeconds,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

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
        console.error("Failed to complete game session:", error);
      } finally {
        // Reset flag after completion (successful or failed)
        completionInProgressRef.current = false;
      }
    },
    [
      gameSessionId,
      gameStartTime,
      sessionCompleted,
      statisticsEnabled,
      scoringEnabled,
      saveGameScore,
    ]
  );

  const latestScoreRequestRef = useRef(0);

  const calculateScoreFromApi = useCallback(
    async ({ phrasesFound, totalPhrases, durationSeconds, hintsCount }) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

      // For anonymous users: calculate client-side (no need for API call)
      if (!token) {
        // Use loaded rules or fall back to defaults
        return calculateScoreClientSide(
          difficulty,
          phrasesFound,
          totalPhrases,
          durationSeconds,
          hintsCount,
          scoringRules || DEFAULT_SCORING_RULES
        );
      }

      // For authenticated users: use server-side calculation (ensures consistency with saved scores)
      try {
        const response = await axios.post(
          `${API_ENDPOINTS.GAME}/system/calculate-score`,
          {
            difficulty,
            phrases_found: phrasesFound,
            total_phrases: totalPhrases,
            duration_seconds: durationSeconds,
            hints_used: hintsCount,
          }
        );
        return response.data;
      } catch (error) {
        console.error(
          "Failed to calculate score from API, falling back to client-side:",
          error
        );
        // Fallback to client-side calculation if API fails
        return calculateScoreClientSide(
          difficulty,
          phrasesFound,
          totalPhrases,
          durationSeconds,
          hintsCount,
          scoringRules || DEFAULT_SCORING_RULES
        );
      }
    },
    [difficulty, scoringRules]
  );

  const updateScore = useCallback(
    async (phrasesFound, durationSeconds = 0, hintsCount = hintsUsed) => {
      if (!scoringEnabled) return;

      const totalPhrases = phrases.length;
      if (totalPhrases === 0) {
        setCurrentScore(0);
        return;
      }

      const requestId = ++latestScoreRequestRef.current;
      const result = await calculateScoreFromApi({
        phrasesFound,
        totalPhrases,
        durationSeconds,
        hintsCount,
      });

      if (result && latestScoreRequestRef.current === requestId) {
        setCurrentScore(result.final_score);
      }
    },
    [scoringEnabled, phrases.length, calculateScoreFromApi, hintsUsed]
  );

  const ensureScoreBreakdownFromApi = useCallback(async () => {
    if (!scoringEnabled) {
      return;
    }

    const totalPhrases = phrases.length;
    if (totalPhrases === 0) {
      return;
    }

    const result = await calculateScoreFromApi({
      phrasesFound: found.length,
      totalPhrases,
      durationSeconds: currentElapsedTimeRef.current,
      hintsCount: hintsUsed,
    });

    if (!result) {
      return;
    }

    const basePoints =
      scoringRules?.base_points_per_phrase ??
      DEFAULT_SCORING_RULES.base_points_per_phrase;
    const multiplierMap =
      scoringRules?.difficulty_multipliers ??
      DEFAULT_SCORING_RULES.difficulty_multipliers;
    const multiplier = multiplierMap?.[difficulty] ?? 1;
    const perPhraseEntries = found.map((phraseValue, index) => {
      const phraseObj = phrases.find((item) => {
        if (item && typeof item === "object") {
          return item.phrase === phraseValue;
        }
        return item === phraseValue;
      });
      const phraseLabel =
        phraseObj && phraseObj.phrase ? phraseObj.phrase : phraseValue;
      const phraseId =
        phraseObj && phraseObj.id !== undefined
          ? phraseObj.id
          : `${phraseLabel}-${index}`;
      const phrasePoints = Math.max(0, Math.round(basePoints * multiplier));
      return {
        id: phraseId,
        phrase: phraseLabel,
        points: phrasePoints,
      };
    });

    setScoreBreakdown({
      ...result,
      per_phrase: perPhraseEntries,
      hints_used: hintsUsed,
      hint_penalty_per_hint:
        result.hint_penalty_per_hint ??
        scoringRules?.hint_penalty_per_hint ??
        DEFAULT_SCORING_RULES.hint_penalty_per_hint,
      duration_seconds: currentElapsedTimeRef.current,
      difficulty,
      total_phrases: totalPhrases,
      phrases_found: found.length,
      source: "api-preview",
    });
  }, [
    scoringEnabled,
    phrases,
    calculateScoreFromApi,
    found,
    hintsUsed,
    scoringRules,
    difficulty,
  ]);

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
          setRemainingHints((prev) => prev - 1);
          setHintsUsed((prev) => prev + 1);
        }
      } else {
        // Advance to next hint level
        gridRef.current.advanceProgressiveHint();
        setCurrentHintLevel((prev) => prev + 1);
        setRemainingHints((prev) => prev - 1);
        setHintsUsed((prev) => prev + 1);

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
        setHintsUsed((prev) => prev + 1);
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
    currentElapsedTimeRef.current = 0;
    latestScoreRequestRef.current = 0;
    setFound([]);
    setTimerResetTrigger((prev) => prev + 1);
    setIsPaused(false);

    if (gridRef.current) {
      gridRef.current.clearHints();
    }
  }, []);

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
    // Complete session when all phrases are found (only once)
    if (allFound && gameSessionId && gameStartTime && !sessionCompleted) {
      completeGameSession(found.length, true);
    }
  }, [
    allFound,
    gameSessionId,
    gameStartTime,
    sessionCompleted,
    completeGameSession,
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

  const visibleCategories = categories.filter(
    (cat) =>
      !ignoredCategories.includes(cat) && !userIgnoredCategories.includes(cat)
  );
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

  // Callback function for AdminPanel to update user ignored categories
  const updateUserIgnoredCategories = (newCategories) => {
    setUserIgnoredCategories(newCategories);
  };

  // Define the Game View to be reused across multiple routes
  const gameView = (
    <Stack spacing={3} alignItems="center">
      {/* Use GameHeader component instead of duplicated header code */}
      <GameHeader
        logoFilter={logoFilter}
        handleLogoClick={changeLogoColor}
        showCelebration={showCelebration}
        isDarkMode={isDarkMode}
        currentUser={currentUser}
        gameType={!isAdminRoute ? gameType : undefined}
        onGameTypeChange={!isAdminRoute ? (type) => {
          setGameType(type);
          // Update URL based on game type
          if (type === 'crossword') {
            navigate('/crosswords');
          } else {
            navigate('/wordsearch');
          }
          // Reload puzzle with new game type
          loadPuzzle(selectedCategory, difficulty, true, type);
        } : undefined}
        isGridLoading={isGridLoading}
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
        currentUser={currentUser}
        selectedPrivateListId={selectedPrivateListId}
        onPrivateListChange={(listId) => {
          setSelectedPrivateListId(listId);
        }}
      />

      {/* All Found Message - Desktop Only */}
      {!isTouchDevice && (
        <AllFoundMessage
          allFound={allFound}
          loadPuzzle={loadPuzzle}
          refreshPuzzle={refreshPuzzle}
          selectedCategory={selectedCategory}
          difficulty={difficulty}
          canShowBreakdown={scoringEnabled && !!scoreBreakdown}
          onShowBreakdown={openScoreBreakdownDialog}
        />
      )}

      {/* Timer and Score Display at Top - Mobile Layout Only */}
      {isTouchDevice && scoringEnabled && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <Timer
            isActive={isTimerActive}
            isPaused={isPaused}
            onTimeUpdate={handleTimerUpdate}
            startTime={gameStartTime}
            resetTrigger={timerResetTrigger}
            showTimer={scoringEnabled}
            currentElapsedTime={currentElapsedTime}
            onTogglePause={handlePauseToggle}
            canPause={found.length > 0 && !allFound}
          />
          <ScoreDisplay
            currentScore={currentScore}
            scoreBreakdown={scoreBreakdown}
            phrasesFound={found.length}
            totalPhrases={phrases.length}
            hintsUsed={hintsUsed}
            showScore={scoringEnabled}
            compact={true}
            scoringRules={scoringRules}
            scoringRulesStatus={scoringRulesStatus}
            onReloadScoringRules={() =>
              loadScoringRules({ force: true })
            }
            registerDialogOpener={registerScoreDialogOpener}
          />
          {allFound && (
            <Button
              onClick={() => refreshPuzzle(selectedCategory, difficulty)}
              variant="contained"
              sx={{
                minWidth: '48px',
                minHeight: '48px',
                fontSize: '1.5rem'
              }}
            >
              🆕
            </Button>
          )}
        </Box>
      )}

      {/* Main Game Area */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: "100vw",
          position: "relative",
          gap: useMobileLayout ? 3 : { xs: 3, md: 6 },
          justifyContent: "center",
          overflow: "hidden", // Prevent horizontal overflow
        }}
      >
        <Box
          sx={{
            position: "relative",
            flex: "0 0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: useMobileLayout ? "100%" : "auto",
            maxWidth: "100%",
          }}
        >
          <Box
            sx={{
              filter: (isScreenTooSmall || isGridTooSmall) ? 'blur(8px)' : 'none',
              pointerEvents: (isScreenTooSmall || isGridTooSmall) ? 'none' : 'auto',
            }}
          >
            {gameType === "crossword" ? (
              <CrosswordGrid
                key={`crossword-${selectedCategory}-${difficulty}`}
                ref={gridRef}
                grid={grid}
                phrases={phrases}
                onPhraseComplete={(phrase) => {
                  markFound(phrase);
                }}
                onPhraseWrong={() => { }}
                disabled={allFound || isScreenTooSmall || isGridTooSmall}
                isDarkMode={isDarkMode}
                showWrongHighlight={true}
                onHintUsed={() => { }}
                isTouchDevice={isTouchDevice}
                useMobileLayout={useMobileLayout}
              />
            ) : (
              <ScrabbleGrid
                key={`wordsearch-${selectedCategory}-${difficulty}`}
                ref={gridRef}
                grid={grid}
                phrases={phrases}
                found={found}
                onFound={markFound}
                disabled={allFound || isScreenTooSmall || isGridTooSmall}
                isDarkMode={isDarkMode}
                showCelebration={showCelebration}
                onHintUsed={() => { }} // Placeholder - hint tracking is handled in handleHintRequest
                onGridInteraction={handleGridInteraction}
                isTouchDevice={isTouchDevice}
                useMobileLayout={useMobileLayout}
              />
            )}
          </Box>

          <LoadingOverlay
            isLoading={isGridLoading}
            isDarkMode={isDarkMode}
          />

          <NotEnoughPhrasesOverlay
            show={notEnoughPhrases}
            message={notEnoughPhrasesMsg}
            isDarkMode={isDarkMode}
          />

          <ScreenTooSmallOverlay
            visible={isScreenTooSmall || isGridTooSmall}
            isGridTooSmall={isGridTooSmall}
          />
        </Box>

        {/* Sidebar Layout: Phrase List and Controls */}
        {!useMobileLayout && (
          <Box sx={{
            width: { md: 280, lg: 320 },
            display: "flex",
            flexDirection: "column",
            gap: 2,
            position: "sticky",
            top: 24,
            maxHeight: "calc(100vh - 48px)",
            overflowY: "auto",
            pr: 1
          }}>
            {scoringEnabled && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "row", sm: "row" },
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 2,
                  mb: 2,
                  flexWrap: "wrap",
                }}
              >
                <Timer
                  isActive={isTimerActive}
                  isPaused={isPaused}
                  onTimeUpdate={handleTimerUpdate}
                  startTime={gameStartTime}
                  resetTrigger={timerResetTrigger}
                  showTimer={scoringEnabled}
                  currentElapsedTime={currentElapsedTime}
                  onTogglePause={handlePauseToggle}
                  canPause={found.length > 0 && !allFound}
                />
                <ScoreDisplay
                  currentScore={currentScore}
                  scoreBreakdown={scoreBreakdown}
                  phrasesFound={found.length}
                  totalPhrases={phrases.length}
                  hintsUsed={hintsUsed}
                  showScore={scoringEnabled}
                  compact={true}
                  scoringRules={scoringRules}
                  scoringRulesStatus={scoringRulesStatus}
                  onReloadScoringRules={() =>
                    loadScoringRules({ force: true })
                  }
                  registerDialogOpener={registerScoreDialogOpener}
                />
              </Box>
            )}

            {/* Hint Button - only show when progressive hints are enabled */}
            {progressiveHintsEnabled &&
              phrases.length > 0 &&
              found.length < phrases.length && (
                <HintButton
                  onHintRequest={handleHintRequest}
                  remainingHints={remainingHints}
                  isProgressiveMode={progressiveHintsEnabled}
                  disabled={allFound || phrases.length === 0 || isGridTooSmall}
                  currentHintLevel={currentHintLevel}
                  maxHints={3}
                  showHintButton={true}
                  compact={window.innerWidth < 1200}
                  gameType={gameType}
                />
              )}

            <PhraseList
              phrases={phrases}
              found={found}
              hidePhrases={hidePhrases}
              setHidePhrases={setHidePhrases}
              onClickPhrase={(phrase) => {
                // Focus logic handled in Grid
                if (gridRef.current?.focusPhrase) {
                  gridRef.current.focusPhrase(phrase);
                }
              }}
              gameType={gameType}
              showTranslations={showTranslations}
              setShowTranslations={setShowTranslations}
              disableShowPhrases={notEnoughPhrases || isGridTooSmall}
              currentUser={currentUser}
              languageSetId={selectedLanguageSetId}
              compact={window.innerWidth < 1200}
            />
          </Box>
        )}
      </Box>

      {/* Floating Action Buttons for Mobile */}
      {isTouchDevice && (
        <MobileFloatingActions
          onPhraseListClick={() => setMobileSheetOpen(true)}
          onHintClick={handleHintRequest}
          phrasesFound={found.length}
          remainingHints={remainingHints}
          showHintButton={progressiveHintsEnabled && phrases.length > 0 && found.length < phrases.length}
          disabled={allFound || isGridTooSmall}
          isProgressiveMode={progressiveHintsEnabled}
          gameType={gameType}
          currentHintLevel={currentHintLevel}
        />
      )}
      {/* Mobile Layout - Bottom Sheet */}
      {useMobileLayout && (
        <MobilePhraseListSheet
          open={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          phrases={phrases}
          found={found}
          hidePhrases={hidePhrases}
          setHidePhrases={setHidePhrases}
          allFound={allFound}
          showTranslations={showTranslations}
          setShowTranslations={setShowTranslations}
          disableShowPhrases={notEnoughPhrases || isGridTooSmall}
          onPhraseClick={handlePhraseClick}
          progressiveHintsEnabled={progressiveHintsEnabled}
          currentUser={currentUser}
          languageSetId={selectedLanguageSetId}
          t={t}
          gameType={gameType}
        />
      )}
    </Stack>
  );

  return (
    <MUIThemeProvider theme={createAppTheme(isDarkMode)}>
      <CssBaseline />
      {shouldShowSplash && (
        <SplashScreen
          open={!initialLoadComplete}
          messageKey="loading_game"
          isDarkMode={isDarkMode}
          exitDuration={SPLASH_EXIT_DURATION}
        />
      )}
      <Container
        maxWidth="xl"
        sx={{
          minHeight: "100vh",
          py: isTouchDevice ? 0.125 : 2, // 1px on mobile (0.125 * 8px = 1px), 16px on desktop
          px: isTouchDevice ? 0.125 : 2, // 1px horizontal padding on mobile
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
          <Route path="/" element={<Navigate to="/wordsearch" replace />} />

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
            justifyContent: isTouchDevice ? "flex-end" : "center",
            gap: 2,
            px: 2,
          }}
        >
          {!isTouchDevice && (
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

      {/* Cookie Consent Bar */}
      <CookieConsentBar />
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
