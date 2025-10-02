import React, { useRef, useCallback } from 'react';
import Box from '@mui/material/Box';

export default function GridCell({ 
    r, c, cell, 
    isSelected, isFound, isBlinking, isCelebrating, 
    isHintCell = false, directionArrow = null, hintLevel = 0,
    handleMouseDown, handleMouseEnter, cellSize 
}) {
    const lastEnterTime = useRef(0);

    // Generate CSS classes for cell state
    const getCellClasses = () => {
        const classes = ['grid-cell'];
        if (isFound) classes.push('found');
        if (isBlinking) classes.push('blinking');
        if (isSelected) classes.push('selected');
        if (isCelebrating) classes.push('celebrating');
        if (isHintCell) {
            classes.push('hint-cell');
            if (hintLevel === 1) classes.push('hint-first-letter');
            else if (hintLevel === 3) classes.push('hint-full-outline');
        }
        if (directionArrow) classes.push('hint-direction');
        return classes.join(' ');
    };

    // Throttled mouse enter handler for better performance
    const handleThrottledMouseEnter = useCallback(() => {
        const now = Date.now();
        if (now - lastEnterTime.current < 20) return; // 20ms throttle
        lastEnterTime.current = now;
        handleMouseEnter(r, c);
    }, [r, c, handleMouseEnter]);

    const handleCellMouseDown = useCallback(() => {
        handleMouseDown(r, c);
    }, [r, c, handleMouseDown]);

    // Calculate responsive font size
    const fontSize = Math.max(cellSize * 0.5, 12);

    return (
        <Box
            data-row={r}
            data-col={c}
            onMouseDown={handleCellMouseDown}
            onMouseEnter={handleThrottledMouseEnter}
            className={getCellClasses()}
            sx={{
                width: cellSize,
                height: cellSize,
                fontSize: `${fontSize}px`,
                position: 'relative',
            }}
        >
            {cell}
            {directionArrow && (
                <Box
                    className="direction-arrow"
                    sx={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        fontSize: `${Math.max(cellSize * 0.3, 10)}px`,
                        color: '#9c27b0',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                        zIndex: 10
                    }}
                >
                    {directionArrow}
                </Box>
            )}
        </Box>
    );
}