import { useState, useEffect } from 'react';

const useGameDifficulties = () => {
    // Calculate which difficulties are suitable for current screen size
    const getAvailableDifficulties = () => {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Minimum cell size based on device type
        const minCellSize = isTouchDevice ? 32 : 15;
        const padding = 16;

        // Calculate available space similar to useGridSize hook
        let availableWidth, availableHeight;

        if (screenWidth < 900 || isTouchDevice) {
            // Mobile/tablet or touch device
            availableWidth = screenWidth - (padding * 3);
            availableHeight = Math.min(screenHeight * (isTouchDevice ? 0.55 : 0.6), 600);
        } else {
            // Desktop
            const baseWidth = screenWidth > 1200 ? screenWidth * 0.65 : screenWidth * 0.6;
            availableWidth = Math.min(baseWidth, 900);
            availableHeight = Math.min(screenHeight * 0.8, 900);
        }

        const availableSize = (screenWidth < 900 || isTouchDevice) ? availableWidth : Math.min(availableWidth, availableHeight);

        const difficulties = [
            { value: 'very_easy', label: 'Very Easy (8x8)', gridSize: 8 },
            { value: 'easy', label: 'Easy (10x10)', gridSize: 10 },
            { value: 'medium', label: 'Medium (13x13)', gridSize: 13 },
            { value: 'hard', label: 'Hard (15x15)', gridSize: 15 },
            { value: 'very_hard', label: 'Very Hard (20x20)', gridSize: 20 }
        ];

        return difficulties.filter(diff => {
            // Calculate minimum space needed: (gridSize * minCellSize) + gaps (4px between cells)
            const totalGap = (diff.gridSize + 1) * 4;
            const minSpaceNeeded = diff.gridSize * minCellSize + totalGap;
            return minSpaceNeeded <= availableSize;
        });
    };

    const [availableDifficulties, setAvailableDifficulties] = useState(getAvailableDifficulties());

    // Update available difficulties on window resize
    useEffect(() => {
        const handleResize = () => {
            setAvailableDifficulties(getAvailableDifficulties());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        availableDifficulties,
        setAvailableDifficulties
    };
};

export default useGameDifficulties;
