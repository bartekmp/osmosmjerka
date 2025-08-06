import { useState, useEffect } from 'react';

const useGameDifficulties = () => {
    // Calculate which difficulties are suitable for current screen size
    const getAvailableDifficulties = () => {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const maxGridSize = Math.min(screenWidth * 0.9, screenHeight * 0.6);

        const difficulties = [
            { value: 'easy', label: 'Easy (10x10)', gridSize: 10 },
            { value: 'medium', label: 'Medium (13x13)', gridSize: 13 },
            { value: 'hard', label: 'Hard (15x15)', gridSize: 15 },
            { value: 'very_hard', label: 'Very Hard (20x20)', gridSize: 20 }
        ];

        return difficulties.filter(diff => {
            // Calculate minimum space needed: grid size * (min cell size + spacing)
            const minSpaceNeeded = diff.gridSize * 25; // 20px min cell + 5px spacing
            return minSpaceNeeded <= maxGridSize;
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
