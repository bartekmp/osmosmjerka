import logger from '@shared/utils/logger';
import axios from "axios";
import { useCallback, useRef, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

export function useGameSession({ selectedLanguageSetId, statisticsEnabled }) {
  const [gameSessionId, setGameSessionId] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [lastFoundCount, setLastFoundCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const completionInProgressRef = useRef(false);

  const startGameSession = useCallback(
    async (category, difficulty, gridSize, totalPhrases) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token || !selectedLanguageSetId || !statisticsEnabled) return;

      try {
        const response = await axios.post(
          `${API_ENDPOINTS.GAME}/game/start`,
          { language_set_id: selectedLanguageSetId, category, difficulty, grid_size: gridSize, total_phrases: totalPhrases },
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        setGameSessionId(response.data.session_id);
        setGameStartTime((prev) => prev ?? Date.now());
        setLastFoundCount(0);
        setSessionCompleted(false);
        completionInProgressRef.current = false;
      } catch (error) {
        logger.error("Failed to start game session:", error);
      }
    },
    [selectedLanguageSetId, statisticsEnabled]
  );

  const updateGameProgress = useCallback(
    async (phrasesFound) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token || !gameSessionId || !statisticsEnabled) return;

      try {
        await axios.put(
          `${API_ENDPOINTS.GAME}/game/progress`,
          { session_id: gameSessionId, phrases_found: phrasesFound },
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
      } catch (error) {
        logger.error("Failed to update game progress:", error);
      }
    },
    [gameSessionId, statisticsEnabled]
  );

  const completeGameSession = useCallback(
    async (phrasesFound, _isCompleted) => {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (
        !token ||
        !gameSessionId ||
        !gameStartTime ||
        sessionCompleted ||
        completionInProgressRef.current ||
        !statisticsEnabled
      ) {
        return null;
      }

      completionInProgressRef.current = true;
      try {
        const durationSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
        await axios.post(
          `${API_ENDPOINTS.GAME}/game/complete`,
          { session_id: gameSessionId, phrases_found: phrasesFound, duration_seconds: durationSeconds },
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        setSessionCompleted(true);
        setGameSessionId(null);
        setGameStartTime(null);
        setLastFoundCount(0);
        return durationSeconds;
      } catch (error) {
        logger.error("Failed to complete game session:", error);
        return null;
      } finally {
        completionInProgressRef.current = false;
      }
    },
    [gameSessionId, gameStartTime, sessionCompleted, statisticsEnabled]
  );

  const resetSession = useCallback(() => {
    setSessionCompleted(false);
    setGameSessionId(null);
    setGameStartTime(null);
    setLastFoundCount(0);
    completionInProgressRef.current = false;
  }, []);

  return {
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
  };
}
