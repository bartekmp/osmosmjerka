import React from 'react';
import Box from '@mui/material/Box';

export default function GridCell({ r, c, cell, isSelected, isFound, handleMouseDown, handleMouseEnter, cellSize }) {
    const cellClasses = [
        "grid-cell",
        isSelected ? "selected" : "",
        isFound ? "found" : ""
    ].join(" ").trim();

    return (
        <Box
            data-row={r}
            data-col={c}
            onMouseDown={() => handleMouseDown(r, c)}
            onMouseEnter={() => handleMouseEnter(r, c)}
            className={cellClasses}
            sx={{ 
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                fontSize: `${Math.max(cellSize * 0.5, 12)}px`,
                userSelect: 'none', // Prevent text selection
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                touchAction: 'none', // Prevent default touch behaviors
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {cell}
        </Box>
    );
}