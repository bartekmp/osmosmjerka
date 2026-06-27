import { useEffect, useRef, useState } from "react";

const SPLASH_EXIT_DURATION = 600;
const SPLASH_MIN_VISIBLE_DURATION = 1200;

export function useSplash({ languageSetsStatus, categoriesStatus, gridStatus, restored, isAdminRoute }) {
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const splashShownAtRef = useRef(Date.now());

  useEffect(() => {
    if (initialLoadComplete || !restored) return;

    const statuses = [languageSetsStatus, categoriesStatus, gridStatus];
    if (statuses.some((s) => s === "pending")) return;

    const elapsed = Date.now() - splashShownAtRef.current;
    if (elapsed >= SPLASH_MIN_VISIBLE_DURATION) {
      setInitialLoadComplete(true);
      return;
    }

    const timeout = setTimeout(
      () => setInitialLoadComplete(true),
      SPLASH_MIN_VISIBLE_DURATION - elapsed
    );
    return () => clearTimeout(timeout);
  }, [languageSetsStatus, categoriesStatus, gridStatus, initialLoadComplete, restored]);

  useEffect(() => {
    if (isAdminRoute) {
      if (showSplash) setShowSplash(false);
      return;
    }

    if (!restored || !initialLoadComplete) {
      if (!showSplash) splashShownAtRef.current = Date.now();
      setShowSplash(true);
      return;
    }

    const timeout = setTimeout(() => setShowSplash(false), SPLASH_EXIT_DURATION);
    return () => clearTimeout(timeout);
  }, [initialLoadComplete, isAdminRoute, restored, showSplash]);

  return { showSplash, initialLoadComplete };
}
