import { useRef, useCallback } from 'react';

/**
 * Custom hook for managing grid cell size calculations
 * @param {number} gridLength - The size of the grid (e.g., 10 for 10x10)
 * @param {boolean} isTouchDevice - Whether the device has touch capability
 * @param {boolean} useMobileLayout - Whether mobile layout (FABs) is being used
 */
export const useGridSize = (gridLength, isTouchDevice = false, useMobileLayout = false) => {
    const calculateCellSize = useCallback(() => {
        if (!gridLength) return 40;

        // Use 32px minimum for touch devices, 15px for non-touch
        const minSize = isTouchDevice ? 32 : 15;
        const maxSize = 70;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let availableWidth, availableHeight;

        if (useMobileLayout) {
            // Mobile layout - full width available (FABs are below)
            const padding = 48;
            availableWidth = screenWidth - padding;
            availableHeight = Math.min(screenHeight * (isTouchDevice ? 0.55 : 0.6), 600);
        } else if (isTouchDevice) {
            // Touch device with sidebar layout - account for sidebar in same row
            const sidebarWidth = 320;
            const gap = 48;
            const margins = 64;
            availableWidth = screenWidth - sidebarWidth - gap - margins;
            availableHeight = Math.min(screenHeight * 0.55, 600);
        } else {
            // Desktop non-touch - use max 900px for grid
            availableWidth = Math.min(900, screenWidth * 0.6);
            availableHeight = Math.min(screenHeight * 0.8, 900);
        }

        const availableSize = Math.min(availableWidth, availableHeight);
        const totalGap = (gridLength + 1) * 4;
        const cellSize = Math.floor((availableSize - totalGap) / gridLength);
        const effectiveMaxSize = screenWidth > 1200 ? maxSize : Math.min(maxSize, 50);
        const finalCellSize = Math.max(minSize, Math.min(effectiveMaxSize, cellSize));

        // Safety check to ensure grid fits
        const totalGridWidth = gridLength * finalCellSize + totalGap;
        if (totalGridWidth > availableWidth) {
            return Math.max(minSize, Math.floor((availableWidth - totalGap) / gridLength));
        }

        return finalCellSize;
    }, [gridLength, isTouchDevice, useMobileLayout]);

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
