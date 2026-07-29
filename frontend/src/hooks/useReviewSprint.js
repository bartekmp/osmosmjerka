import apiClient, { getAuthToken } from "@shared/utils/apiClient";
import logger from "@shared/utils/logger";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../shared/constants/constants";

// A sprint is a small, finishable batch of due reviews (ADHD-friendly bounded session).
export const SPRINT_SIZE = 5;


/**
 * Drives a spaced-repetition review sprint: fetch due items, flip each flashcard,
 * self-rate (posts to /api/learn/review), advance, then summarize. Requires login.
 */
export function useReviewSprint() {
  // idle | loading | active | empty | done | error | unauthenticated
  const [status, setStatus] = useState("loading");
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState(null);
  const [reviewedCount, setReviewedCount] = useState(0);

  const loadStats = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const [statsRes, streakRes] = await Promise.all([
        apiClient.get(`${API_ENDPOINTS.GAME}/learn/stats`),
        apiClient.get(`${API_ENDPOINTS.GAME}/learn/streak`),
      ]);
      setStats({ ...statsRes.data, streak: streakRes.data?.current ?? 0 });
    } catch (error) {
      logger.error("Failed to load mastery stats:", error);
    }
  }, []);

  const startSprint = useCallback(async () => {
    if (!getAuthToken()) {
      setStatus("unauthenticated");
      return;
    }
    setStatus("loading");
    setRevealed(false);
    setIndex(0);
    setReviewedCount(0);
    try {
      const res = await apiClient.get(`${API_ENDPOINTS.GAME}/learn/due?limit=${SPRINT_SIZE}`);
      const due = Array.isArray(res.data) ? res.data : [];
      setItems(due);
      setStatus(due.length ? "active" : "empty");
      loadStats();
    } catch (error) {
      logger.error("Failed to load due items:", error);
      setStatus("error");
    }
  }, [loadStats]);

  useEffect(() => {
    startSprint();
  }, [startSprint]);

  const reveal = useCallback(() => setRevealed(true), []);

  const rate = useCallback(
    (grade) => {
      const item = items[index];
      if (item && getAuthToken()) {
        apiClient
          .post(`${API_ENDPOINTS.GAME}/learn/review`, {
            language_set_id: item.language_set_id,
            direction: item.direction,
            grade,
            phrase_id: item.phrase_id,
          })
          .catch((error) => logger.error("Failed to record review:", error));
      }
      setReviewedCount((c) => c + 1);
      setRevealed(false);
      setIndex((i) => {
        const next = i + 1;
        if (next >= items.length) {
          setStatus("done");
          loadStats();
        }
        return next;
      });
    },
    [items, index, loadStats]
  );

  return {
    status,
    current: items[index] || null,
    index,
    total: items.length,
    revealed,
    reveal,
    rate,
    stats,
    reviewedCount,
    startSprint,
  };
}
