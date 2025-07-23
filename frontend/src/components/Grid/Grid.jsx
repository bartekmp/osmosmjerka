import React, { useEffect, useRef, useState } from 'react';
import ScrabbleGridCell from './GridCell';
import { getCellFromTouch, getDirection, isStraightLine } from './helpers';
import Box from '@mui/material/Box';
import './Grid.css';

export default function ScrabbleGrid({ grid, words, found, onFound }) {
    const [selected, setSelected] = useState([]);
    const isMouseDown = useRef(false);

    // Handle mouse and touch events for selecting cells
    const handleMouseDown = (r, c) => {
        isMouseDown.current = true;
        setSelected([[r, c]]);
    };

    const handleMouseEnter = (r, c) => {
        if (!isMouseDown.current) return;
        const start = selected[0];
        const newDirection = getDirection(start, [r, c]);
        if (!newDirection) return;

        const dr = Math.sign(r - start[0]);
        const dc = Math.sign(c - start[1]);
        const length = Math.max(Math.abs(r - start[0]), Math.abs(c - start[1])) + 1;
        const newSelected = Array.from({ length }, (_, i) => [start[0] + dr * i, start[1] + dc * i]);

        setSelected(newSelected);
    };

    const handleMouseUp = () => {
        isMouseDown.current = false;
        if (!isStraightLine(selected)) {
            setSelected([]);
            return;
        }

        const selStr = selected.map(([r, c]) => `${r},${c}`).join("");
        for (const w of words) {
            const coordsStr = w.coords.map(([r, c]) => `${r},${c}`).join("");
            const revCoordsStr = w.coords.slice().reverse().map(([r, c]) => `${r},${c}`).join("");
            if (selStr === coordsStr || selStr === revCoordsStr) {
                onFound(w.word);
                break;
            }
        }
        setSelected([]);
    };

    const handleTouchStart = (e) => {
        e.preventDefault(); // Prevent scrolling and other default touch behaviors
        const cell = getCellFromTouch(e);
        if (cell) {
            isMouseDown.current = true;
            setSelected([cell]);
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault(); // Prevent scrolling during selection
        if (!isMouseDown.current) return;
        const cell = getCellFromTouch(e);
        if (cell) {
            handleMouseEnter(...cell);
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault(); // Prevent any default touch end behavior
        handleMouseUp();
    };

    // Function to check if a cell is part of a found word
    const isFound = (r, c) => {
        return words.some(w =>
            found.includes(w.word) &&
            w.coords.some(([wr, wc]) => wr === r && wc === c)
        );
    };

    // Debounce for dynamic grid scaling on mobile devices
    useEffect(() => {
        let timeout;
        function updateScale() {
            if (window.innerWidth <= 600 && grid.length > 0) {
                const cellSize = 2.2; // em
                const totalWidthEm = grid[0].length * cellSize;
                const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                const totalWidthPx = totalWidthEm * fontSize;
                const scale = Math.min(1, (window.innerWidth - 8) / totalWidthPx);
                document.documentElement.style.setProperty('--grid-scale', scale);
            } else {
                document.documentElement.style.setProperty('--grid-scale', 1);
            }
        }
        function debouncedUpdate() {
            clearTimeout(timeout);
            timeout = setTimeout(updateScale, 100);
        }
        updateScale();
        window.addEventListener('resize', debouncedUpdate);
        return () => {
            window.removeEventListener('resize', debouncedUpdate);
            clearTimeout(timeout);
        };
    }, [grid]);

    if (grid.length === 0) return <Box sx={{ p: 2, textAlign: 'center' }}>No puzzle available</Box>;

    const gridSize = grid.length;

    // Calculate optimal cell size that maintains square grid
    const calculateCellSize = () => {
        const minSize = 20; // Minimum cell size in pixels
        const maxSize = 45;  // Maximum cell size in pixels
        const fixedSize = 40; // Consistent cell size for wide screens
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const availableWidth = Math.min(screenWidth * 0.85, 600);
        const availableHeight = Math.min(screenHeight * 0.6, 600);
        const availableSize = Math.min(availableWidth, availableHeight);
        // On wide screens, keep cell size fixed
        if (screenWidth > 900) return fixedSize;
        // Otherwise, scale as before
        const cellSize = Math.floor((availableSize - (gridSize + 1) * 4) / gridSize);
        return Math.max(minSize, Math.min(maxSize, cellSize));
    };

    const cellSize = calculateCellSize();
    const totalGridSize = gridSize * cellSize + (gridSize + 1) * 4;

    return (
        <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            width: '100%',
            p: 2
        }}>
            <Box
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setSelected([])}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd} // Handle touch cancel events
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
                    gap: '4px',
                    padding: '4px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    width: `${totalGridSize}px`,
                    height: `${totalGridSize}px`,
                    touchAction: 'none', // Prevent default touch behaviors
                    userSelect: 'none', // Prevent text selection
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                }}
            >
                {grid.flat().map((cell, index) => {
                    const r = Math.floor(index / gridSize);
                    const c = index % gridSize;
                    const isSelected = selected.some(([sr, sc]) => sr === r && sc === c);
                    
                    return (
                        <ScrabbleGridCell
                            key={`${r}-${c}`}
                            r={r}
                            c={c}
                            cell={cell}
                            isSelected={isSelected}
                            isFound={isFound(r, c)}
                            handleMouseDown={handleMouseDown}
                            handleMouseEnter={handleMouseEnter}
                            cellSize={cellSize}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}
