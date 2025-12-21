import { useState, useEffect } from 'react';

const MIN_SCREEN_WIDTH = 296;

/**
 * Hook to detect if the screen is too small to display the game
 * @returns {boolean} true if screen width is less than minimum required width
 */
export const useScreenTooSmall = () => {
  const [isTooSmall, setIsTooSmall] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsTooSmall(window.innerWidth < MIN_SCREEN_WIDTH);
    };

    // Check immediately
    checkScreenSize();

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return isTooSmall;
};

