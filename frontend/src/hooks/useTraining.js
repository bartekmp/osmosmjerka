import logger from "@shared/utils/logger";
import axios from "axios";
import { useCallback, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

const STORAGE_KEY = "osmosmjerkaTrainingMode";

/**
 * Training mode: after each found/solved word the player self-rates their recall
 * (3-button confidence), which feeds the spaced-repetition model via /api/learn/review.
 *
 * Direction is derived from the game type: crossword = production (clue -> word),
 * word search = recognition (word -> meaning). Requires a logged-in user (reviews are
 * per-account and the endpoint is authenticated).
 */
export function useTraining({ selectedLanguageSetId, gameType }) {
  const [trainingMode, setTrainingModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  // words awaiting a confidence rating: [{ id, phrase, translation }]
  const [ratingQueue, setRatingQueue] = useState([]);

  const setTrainingMode = useCallback((on) => {
    setTrainingModeState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "true" : "false");
    } catch {
      // ignore storage errors
    }
    if (!on) setRatingQueue([]);
  }, []);

  const enqueueForRating = useCallback((item) => {
    if (!item || item.id == null) return;
    setRatingQueue((q) => (q.some((x) => x.id === item.id) ? q : [...q, item]));
  }, []);

  const submitRating = useCallback(
    (grade) => {
      setRatingQueue((q) => {
        const [current, ...rest] = q;
        if (current) {
          const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
          if (token && selectedLanguageSetId != null) {
            const direction = gameType === "crossword" ? "production" : "recognition";
            axios
              .post(
                `${API_ENDPOINTS.GAME}/learn/review`,
                { language_set_id: selectedLanguageSetId, direction, grade, phrase_id: current.id },
                { headers: { Authorization: `Bearer ${token}` } }
              )
              .catch((error) => logger.error("Failed to record review:", error));
          }
        }
        return rest;
      });
    },
    [gameType, selectedLanguageSetId]
  );

  const skipRating = useCallback(() => setRatingQueue((q) => q.slice(1)), []);

  return {
    trainingMode,
    setTrainingMode,
    enqueueForRating,
    submitRating,
    skipRating,
    currentRating: ratingQueue[0] || null,
    pendingCount: ratingQueue.length,
  };
}
