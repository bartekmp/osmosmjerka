import logger from "@shared/utils/logger";
import { useCallback, useEffect, useState } from "react";
import {
  downloadVoice,
  isLocalTtsSupported,
  listVoicesForLang,
  removeVoice,
  setCachedInstalledVoices,
  speak as engineSpeak,
  storedVoices,
  voiceMatchesLang,
} from "./localTts";

/**
 * Manages in-browser Piper voices for a given target language: which voices are
 * installable, which are already downloaded/cached, downloading with progress, deleting,
 * and speaking with the first installed voice. The heavy engine loads lazily on first use.
 */
export function useLocalTts(lang) {
  // idle | loading | ready | error | unsupported
  const [status, setStatus] = useState("idle");
  const [available, setAvailable] = useState([]); // installable voiceIds for lang
  const [stored, setStored] = useState([]); // downloaded voiceIds (all languages)
  const [progress, setProgress] = useState(null); // { id, pct } while downloading

  // Keep both React state and the cheap localStorage mirror in sync.
  const syncStored = useCallback((ids) => {
    setStored(ids);
    setCachedInstalledVoices(ids);
  }, []);

  const refresh = useCallback(async () => {
    if (!lang) return;
    if (!isLocalTtsSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    try {
      const [avail, downloaded] = await Promise.all([listVoicesForLang(lang), storedVoices()]);
      setAvailable(avail);
      syncStored(downloaded);
      setStatus("ready");
    } catch (error) {
      logger.error("Failed to load local TTS voices:", error);
      setStatus("error");
    }
  }, [lang]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const storedForLang = stored.filter((id) => voiceMatchesLang(id, lang));
  const preferredVoice = storedForLang[0] || null;

  const download = useCallback(async (voiceId) => {
    setProgress({ id: voiceId, pct: 0 });
    try {
      await downloadVoice(voiceId, (p) => {
        const pct = p && p.total ? Math.round((p.loaded * 100) / p.total) : 0;
        setProgress({ id: voiceId, pct });
      });
      syncStored(await storedVoices());
    } catch (error) {
      logger.error("Voice download failed:", error);
    } finally {
      setProgress(null);
    }
  }, [syncStored]);

  const remove = useCallback(async (voiceId) => {
    try {
      await removeVoice(voiceId);
      syncStored(await storedVoices());
    } catch (error) {
      logger.error("Voice removal failed:", error);
    }
  }, [syncStored]);

  const speak = useCallback(
    (text, voiceId) => engineSpeak(text, voiceId || preferredVoice),
    [preferredVoice]
  );

  return {
    status,
    available,
    stored,
    storedForLang,
    preferredVoice,
    hasVoice: !!preferredVoice,
    progress,
    download,
    remove,
    speak,
    refresh,
  };
}
