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
    // Detect touch capability via an actual coarse (touch) pointer.
    //
    // We deliberately rely on `(any-pointer: coarse)` rather than
    // `navigator.maxTouchPoints` or `'ontouchstart' in window`: Firefox under
    // Wayland reports a phantom `maxTouchPoints: 1` (and exposes `ontouchstart`)
    // on non-touch laptops, which only expose a fine pointer. Trusting those
    // signals forced the mobile layout on a regular desktop. `any-pointer:
    // coarse` is true only when a real coarse pointer exists, and also covers
    // hybrid devices (touch laptops with a mouse) where the primary pointer is
    // fine.
    const COARSE_POINTER_QUERY = '(any-pointer: coarse)';
    const checkTouchDevice = () => {
      setIsTouchDevice(window.matchMedia(COARSE_POINTER_QUERY).matches);
    };

    // Check immediately
    checkTouchDevice();

    // Also listen for changes (e.g., plugging in / removing a touch display)
    const mediaQuery = window.matchMedia(COARSE_POINTER_QUERY);
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

