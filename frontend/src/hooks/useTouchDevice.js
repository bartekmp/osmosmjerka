import { useState, useEffect } from 'react';

/**
 * Hook to detect if the device has touch capability
 * This distinguishes touch devices (phones/tablets) from small desktop/laptop screens
 * 
 * @returns {boolean} true if device has touch capability
 */
export const useTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch capability
    // We check multiple indicators to be thorough:
    // 1. 'ontouchstart' in window - most reliable
    // 2. navigator.maxTouchPoints > 0 - modern API
    // 3. window.matchMedia('(pointer: coarse)') - CSS media query
    const checkTouchDevice = () => {
      const hasTouchStart = 'ontouchstart' in window;
      const hasMaxTouchPoints = navigator.maxTouchPoints > 0;
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

      // Device is touch-capable if any of these are true
      // Hybrid devices (tablet with stylus) that have both fine and coarse pointers
      // are still considered touch devices
      const isTouch = hasTouchStart || hasMaxTouchPoints || hasCoarsePointer;

      setIsTouchDevice(isTouch);
    };

    // Check immediately
    checkTouchDevice();

    // Also listen for changes (e.g., device orientation, external displays)
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => checkTouchDevice();

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isTouchDevice;
};

