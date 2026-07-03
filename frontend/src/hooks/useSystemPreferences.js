import logger from '@shared/utils/logger';
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../shared/constants/constants";

export function useSystemPreferences() {
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [progressiveHintsEnabled, setProgressiveHintsEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const checkPreferences = useCallback(async () => {
    try {
      const [scoringRes, hintsRes, ttsRes] = await Promise.all([
        axios.get(`${API_ENDPOINTS.GAME}/system/scoring-enabled`),
        axios.get(`${API_ENDPOINTS.GAME}/system/progressive-hints-enabled`),
        axios.get(`${API_ENDPOINTS.GAME}/system/tts-enabled`).catch(() => ({ data: { enabled: true } })),
      ]);
      setScoringEnabled(scoringRes.data.enabled);
      setProgressiveHintsEnabled(hintsRes.data.enabled);
      setTtsEnabled(ttsRes.data.enabled);
    } catch (error) {
      logger.error("Failed to check system preferences:", error);
      setScoringEnabled(true);
      setProgressiveHintsEnabled(false);
      setTtsEnabled(true);
    }
  }, []);

  useEffect(() => {
    checkPreferences();
  }, [checkPreferences]);

  useEffect(() => {
    const handleAuthChanged = () => checkPreferences();
    window.addEventListener("admin-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("admin-auth-changed", handleAuthChanged);
  }, [checkPreferences]);

  return { scoringEnabled, progressiveHintsEnabled, ttsEnabled };
}
