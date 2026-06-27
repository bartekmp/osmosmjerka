import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../shared/constants/constants";

export function useSystemPreferences() {
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [progressiveHintsEnabled, setProgressiveHintsEnabled] = useState(false);

  const checkPreferences = useCallback(async () => {
    try {
      const [scoringRes, hintsRes] = await Promise.all([
        axios.get(`${API_ENDPOINTS.GAME}/system/scoring-enabled`),
        axios.get(`${API_ENDPOINTS.GAME}/system/progressive-hints-enabled`),
      ]);
      setScoringEnabled(scoringRes.data.enabled);
      setProgressiveHintsEnabled(hintsRes.data.enabled);
    } catch (error) {
      console.error("Failed to check system preferences:", error);
      setScoringEnabled(true);
      setProgressiveHintsEnabled(false);
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

  return { scoringEnabled, progressiveHintsEnabled };
}
