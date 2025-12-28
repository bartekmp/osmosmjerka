import { useState, useEffect } from 'react';

const MIN_CELL_SIZE = 32;

/**
 * Hook to detect if the grid cells would be too small to display properly
 * @param {number} gridLength - The size of the grid (e.g., 10 for 10x10)
 * @param {boolean} isTouchDevice - Whether the device has touch capability
 * @param {boolean} useMobileLayout - Whether mobile layout is being used
 * @returns {boolean} true if calculated cell size would be less than minimum
 */
export const useGridTooSmall = (gridLength, isTouchDevice, useMobileLayout) => {
    const [isTooSmall, setIsTooSmall] = useState(false);

    useEffect(() => {
        const checkGridSize = () => {
            if (!gridLength) {
                setIsTooSmall(false);
                return;
            }

            const screenWidth = window.innerWidth;
            let availableWidth;

            if (useMobileLayout) {
                // Mobile layout - full width available (FABs are below)
                const padding = 48;
                availableWidth = screenWidth - padding;
            } else if (isTouchDevice) {
                // Touch device with sidebar layout
                const sidebarWidth = 240; // Use compact sidebar width
                const gap = 48;
                const margins = 64;
                availableWidth = screenWidth - sidebarWidth - gap - margins;
            } else {
                // Desktop non-touch - use max 900px for grid or 60% of width
                availableWidth = Math.min(900, screenWidth * 0.6);
            }

            const totalGap = (gridLength + 1) * 4;
            const calculatedCellSize = Math.floor((availableWidth - totalGap) / gridLength);

            setIsTooSmall(calculatedCellSize < MIN_CELL_SIZE);
        };

        checkGridSize();
        window.addEventListener('resize', checkGridSize);
        return () => window.removeEventListener('resize', checkGridSize);
    }, [gridLength, isTouchDevice, useMobileLayout]);

    return isTooSmall;
};
