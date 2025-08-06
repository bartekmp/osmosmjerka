import React, { useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import './GridCell.css';

export default function GridCell({ r, c, cell, isSelected, isFound, isBlinking, isCelebrating, handleMouseDown, handleMouseEnter, cellSize }) {
    const lastEnterTime = useRef(0);

    // Generate CSS classes for cell state
    const getCellClasses = () => {
        const classes = ['grid-cell'];
        if (isFound) classes.push('found');
        if (isBlinking) classes.push('blinking');
        if (isSelected) classes.push('selected');
        if (isCelebrating) classes.push('celebrating');
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
            }}
        >
            {cell}
        </Box>
    );
}