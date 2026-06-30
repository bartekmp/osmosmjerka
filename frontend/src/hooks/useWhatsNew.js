import logger from '@shared/utils/logger';
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../shared/constants/constants";
import {
  fetchWhatsNew,
  getCurrentVersion,
  getLastSeenVersion,
  isNewerVersion,
  setLastSeenVersion,
} from "../shared/utils/versionUtils";

export function useWhatsNew() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewEntries, setWhatsNewEntries] = useState([]);

  const checkWhatsNew = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;

    try {
      const currentVersion = await getCurrentVersion();
      if (!currentVersion) return;

      const lastSeenVersion = getLastSeenVersion();
      if (!isNewerVersion(currentVersion, lastSeenVersion)) return;

      const entries = await fetchWhatsNew(lastSeenVersion, 5);
      if (entries && entries.length > 0) {
        setWhatsNewEntries(entries);
        setShowWhatsNew(true);
      } else {
        setLastSeenVersion(currentVersion);
      }
    } catch (error) {
      logger.warn("Failed to check for updates:", error);
    }
  }, []);

  const handleWhatsNewClose = useCallback(async () => {
    setShowWhatsNew(false);
    const currentVersion = await getCurrentVersion();
    if (currentVersion) {
      setLastSeenVersion(currentVersion);
    }
  }, []);

  useEffect(() => {
    checkWhatsNew();
  }, [checkWhatsNew]);

  useEffect(() => {
    const handleAuthChanged = () => setTimeout(checkWhatsNew, 500);
    window.addEventListener("admin-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("admin-auth-changed", handleAuthChanged);
  }, [checkWhatsNew]);

  return { showWhatsNew, whatsNewEntries, handleWhatsNewClose };
}
