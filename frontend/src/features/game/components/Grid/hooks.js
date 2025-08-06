import { useRef, useCallback } from 'react';

/**
 * Custom hook for managing grid cell size calculations
 */
export const useGridSize = (gridLength) => {
    const calculateCellSize = useCallback(() => {
        if (!gridLength) return 40;

        const minSize = 15;
        const maxSize = 70;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const padding = 16;

        let availableWidth, availableHeight;

        if (screenWidth < 900) {
            // Mobile/tablet
            availableWidth = screenWidth - (padding * 3);
            availableHeight = Math.min(screenHeight * 0.6, 600);
        } else {
            // Desktop
            const baseWidth = screenWidth > 1200 ? screenWidth * 0.65 : screenWidth * 0.6;
            availableWidth = Math.min(baseWidth, 900);
            availableHeight = Math.min(screenHeight * 0.8, 900);
        }

        const availableSize = screenWidth < 900 ? availableWidth : Math.min(availableWidth, availableHeight);
        const totalGap = (gridLength + 1) * 4;
        const cellSize = Math.floor((availableSize - totalGap) / gridLength);
        const effectiveMaxSize = screenWidth > 1200 ? maxSize : Math.min(maxSize, 50);
        const finalCellSize = Math.max(minSize, Math.min(effectiveMaxSize, cellSize));

        // Mobile safety check
        if (screenWidth < 900) {
            const totalGridWidth = gridLength * finalCellSize + totalGap;
            if (totalGridWidth > availableWidth) {
                return Math.max(minSize, Math.floor((availableWidth - totalGap) / gridLength));
            }
        }

        return finalCellSize;
    }, [gridLength]);

    return calculateCellSize();
};

/**
 * Custom hook for managing mouse selection state
 */
export const useMouseSelection = () => {
    const isMouseDown = useRef(false);
    const selectionStart = useRef(null);
    const lastDirection = useRef(null);

    const startSelection = useCallback((row, col) => {
        isMouseDown.current = true;
        selectionStart.current = [row, col];
        lastDirection.current = null;
    }, []);

    const endSelection = useCallback(() => {
        isMouseDown.current = false;
        selectionStart.current = null;
        lastDirection.current = null;
    }, []);

    return {
        isMouseDown,
        selectionStart,
        lastDirection,
        startSelection,
        endSelection
    };
};

/**
 * Custom hook for throttled operations
 */
export const useThrottle = (callback, delay) => {
    const lastCallTime = useRef(0);

    return useCallback((...args) => {
        const now = Date.now();
        if (now - lastCallTime.current >= delay) {
            lastCallTime.current = now;
            return callback(...args);
        }
    }, [callback, delay]);
};
