import logger from "@shared/utils/logger";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

/**
 * Lightweight mastery/streak summary for logged-in users, shown on the main game
 * screen (see also useReviewSprint's own loadStats, used on the /review page).
 */
export function useMasteryStats({ currentUser, languageSetId } = {}) {
  const [stats, setStats] = useState(null);

  const refreshStats = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token || !currentUser) {
      setStats(null);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const params = languageSetId != null ? `?language_set_id=${languageSetId}` : "";
      const [statsRes, streakRes] = await Promise.all([
        axios.get(`${API_ENDPOINTS.GAME}/learn/stats${params}`, { headers }),
        axios.get(`${API_ENDPOINTS.GAME}/learn/streak`, { headers }),
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
