import logger from '@shared/utils/logger';
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";
import { calculateScoreClientSide, DEFAULT_SCORING_RULES } from "../utils/scoringUtils";

export function useScoring({
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
}) {
  const [currentScore, setCurrentScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const [scoringRules, setScoringRules] = useState(null);
  const [scoringRulesStatus, setScoringRulesStatus] = useState("idle");
  const [firstPhraseTime, setFirstPhraseTime] = useState(null);
  const [timerResetTrigger, setTimerResetTrigger] = useState(0);
  const scoreDialogOpenerRef = useRef(null);
  const latestScoreRequestRef = useRef(0);

  const loadScoringRules = useCallback(
    async ({ force = false } = {}) => {
      if (!force && scoringRulesStatus === "loading") return;
      setScoringRulesStatus("loading");
      try {
        const response = await axios.get(`${API_ENDPOINTS.GAME}/system/scoring-rules`);
        setScoringRules(response.data);
        setScoringRulesStatus("loaded");
      } catch (error) {
        logger.error("Failed to load scoring rules:", error);
        setScoringRulesStatus("error");
      }
    },
    [scoringRulesStatus]
  );

  useEffect(() => {
    if (!scoringEnabled) return;
    if (scoringRulesStatus === "idle" || (scoringRulesStatus === "error" && !scoringRules)) {
      loadScoringRules();
    }
  }, [loadScoringRules, scoringEnabled, scoringRules, scoringRulesStatus]);

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
            difficulty,
            grid_size: grid.length,
            total_phrases: phrases.length,
            phrases_found: phrasesFound,
            hints_used: hintsUsed,
            duration_seconds: durationSeconds,
            first_phrase_time: firstPhraseTime,
            completion_time: completionTime,
          },
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );

        const scoringDetails = response?.data?.scoring_details;
        if (!scoringDetails) return;

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
            scoringRules?.hint_penalty_per_hint ?? DEFAULT_SCORING_RULES.hint_penalty_per_hint,
          duration_seconds: durationSeconds,
          difficulty,
          total_phrases: phrases.length,
          phrases_found: totalFoundPhrases,
          source: "final",
        });
        setCurrentScore(scoringDetails.final_score);
      } catch (error) {
        logger.error("Failed to save game score:", error);
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

  const calculateScoreFromApi = useCallback(
    async ({ phrasesFound, totalPhrases, durationSeconds, hintsCount }) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) {
        return calculateScoreClientSide(
          difficulty,
          phrasesFound,
          totalPhrases,
          durationSeconds,
          hintsCount,
          scoringRules || DEFAULT_SCORING_RULES
        );
      }
      try {
        const response = await axios.post(`${API_ENDPOINTS.GAME}/system/calculate-score`, {
          difficulty,
          phrases_found: phrasesFound,
          total_phrases: totalPhrases,
          duration_seconds: durationSeconds,
          hints_used: hintsCount,
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to calculate score from API, falling back to client-side:", error);
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
      const result = await calculateScoreFromApi({ phrasesFound, totalPhrases, durationSeconds, hintsCount });
      if (result && latestScoreRequestRef.current === requestId) {
        setCurrentScore(result.final_score);
      }
    },
    [scoringEnabled, phrases.length, calculateScoreFromApi, hintsUsed]
  );

  const ensureScoreBreakdownFromApi = useCallback(async () => {
    if (!scoringEnabled) return;
    const totalPhrases = phrases.length;
    if (totalPhrases === 0) return;

    const result = await calculateScoreFromApi({
      phrasesFound: found.length,
      totalPhrases,
      durationSeconds: currentElapsedTimeRef.current,
      hintsCount: hintsUsed,
    });
    if (!result) return;

    const basePoints = scoringRules?.base_points_per_phrase ?? DEFAULT_SCORING_RULES.base_points_per_phrase;
    const multiplierMap = scoringRules?.difficulty_multipliers ?? DEFAULT_SCORING_RULES.difficulty_multipliers;
    const multiplier = multiplierMap?.[difficulty] ?? 1;
    const perPhraseEntries = found.map((phraseValue, index) => {
      const phraseObj = phrases.find((item) =>
        item && typeof item === "object" ? item.phrase === phraseValue : item === phraseValue
      );
      const phraseLabel = phraseObj?.phrase ?? phraseValue;
      const phraseId = phraseObj?.id !== undefined ? phraseObj.id : `${phraseLabel}-${index}`;
      return { id: phraseId, phrase: phraseLabel, points: Math.max(0, Math.round(basePoints * multiplier)) };
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
  }, [scoringEnabled, phrases, calculateScoreFromApi, found, hintsUsed, scoringRules, difficulty, currentElapsedTimeRef]);

  const registerScoreDialogOpener = useCallback((fn) => {
    scoreDialogOpenerRef.current = typeof fn === "function" ? fn : null;
  }, []);

  const openScoreBreakdownDialog = useCallback(() => {
    if (scoreDialogOpenerRef.current) scoreDialogOpenerRef.current();
  }, []);

  const resetScoringState = useCallback(() => {
    setCurrentScore(0);
    setScoreBreakdown(null);
    setFirstPhraseTime(null);
    setTimerResetTrigger((prev) => prev + 1);
    latestScoreRequestRef.current = 0;
  }, []);

  return {
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
  };
}
