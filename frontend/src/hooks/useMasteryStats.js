import apiClient, { getAuthToken } from "@shared/utils/apiClient";
import logger from "@shared/utils/logger";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../shared/constants/constants";

/**
 * Lightweight mastery/streak summary for logged-in users, shown on the main game
 * screen (see also useReviewSprint's own loadStats, used on the /review page).
 */
export function useMasteryStats({ currentUser, languageSetId } = {}) {
  const [stats, setStats] = useState(null);

  const refreshStats = useCallback(async () => {
    if (!getAuthToken() || !currentUser) {
      setStats(null);
      return;
    }
    try {
      const params = languageSetId != null ? `?language_set_id=${languageSetId}` : "";
      const [statsRes, streakRes] = await Promise.all([
        apiClient.get(`${API_ENDPOINTS.GAME}/learn/stats${params}`),
        apiClient.get(`${API_ENDPOINTS.GAME}/learn/streak`),
      ]);
      setStats({ ...statsRes.data, streak: streakRes.data?.current ?? 0 });
    } catch (error) {
      logger.error("Failed to load mastery stats:", error);
    }
  }, [currentUser, languageSetId]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return { stats, refreshStats };
}
