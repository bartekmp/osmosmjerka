import logger from "@shared/utils/logger";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

// A sprint is a small, finishable batch of due reviews (ADHD-friendly bounded session).
export const SPRINT_SIZE = 5;

const token = () => localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

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
    const t = token();
    if (!t) return;
    const headers = { Authorization: `Bearer ${t}` };
    try {
      const [statsRes, streakRes] = await Promise.all([
        axios.get(`${API_ENDPOINTS.GAME}/learn/stats`, { headers }),
        axios.get(`${API_ENDPOINTS.GAME}/learn/streak`, { headers }),
      ]);
      setStats({ ...statsRes.data, streak: streakRes.data?.current ?? 0 });
    } catch (error) {
      logger.error("Failed to load mastery stats:", error);
    }
  }, []);

  const startSprint = useCallback(async () => {
    const t = token();
    if (!t) {
      setStatus("unauthenticated");
      return;
    }
    setStatus("loading");
    setRevealed(false);
    setIndex(0);
    setReviewedCount(0);
    try {
      const res = await axios.get(`${API_ENDPOINTS.GAME}/learn/due?limit=${SPRINT_SIZE}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
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
      const t = token();
      const item = items[index];
      if (item && t) {
        axios
          .post(
            `${API_ENDPOINTS.GAME}/learn/review`,
            {
              language_set_id: item.language_set_id,
              direction: item.direction,
              grade,
              phrase_id: item.phrase_id,
            },
            { headers: { Authorization: `Bearer ${t}` } }
          )
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
