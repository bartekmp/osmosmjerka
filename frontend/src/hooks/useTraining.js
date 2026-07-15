import logger from "@shared/utils/logger";
import axios from "axios";
import { useCallback, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

/**
 * After each found/solved word a logged-in player self-rates their recall (3-button
 * confidence), which feeds the spaced-repetition model via /api/learn/review. Always
 * active for logged-in users (callers gate `enqueueForRating` on `currentUser`).
 *
 * Direction is derived from the game type: crossword = production (clue -> word),
 * word search = recognition (word -> meaning). Requires a logged-in user (reviews are
 * per-account and the endpoint is authenticated).
 */
export function useTraining({ selectedLanguageSetId, gameType }) {
  // words awaiting a confidence rating: [{ id, phrase, translation }]
  const [ratingQueue, setRatingQueue] = useState([]);

  const enqueueForRating = useCallback((item) => {
    if (!item || item.id == null) return;
    setRatingQueue((q) => (q.some((x) => x.id === item.id) ? q : [...q, item]));
  }, []);

  const submitRating = useCallback(
    (grade) => {
      // The POST is a side effect and must NOT live inside the setRatingQueue updater —
      // React (StrictMode, and concurrent rendering in general) may invoke updaters more
      // than once, which would fire the request twice for one rating.
      const current = ratingQueue[0];
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
      setRatingQueue((q) => q.slice(1));
    },
    [gameType, selectedLanguageSetId, ratingQueue]
  );

  const skipRating = useCallback(() => setRatingQueue((q) => q.slice(1)), []);

  return {
    enqueueForRating,
    submitRating,
    skipRating,
    currentRating: ratingQueue[0] || null,
    pendingCount: ratingQueue.length,
  };
}
