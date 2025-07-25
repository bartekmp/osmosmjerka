import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ScrabbleGridCell from './GridCell';
import { getCellFromTouch, getDirection, isStraightLine } from './helpers';
import Box from '@mui/material/Box';
import './Grid.css';

const ScrabbleGrid = forwardRef(({ grid, words, found, onFound, disabled = false }, ref) => {
    const [selected, setSelected] = useState([]);
    const [blinkingCells, setBlinkingCells] = useState([]);
    const isMouseDown = useRef(false);
    const selectionStart = useRef(null);
    const lastDirection = useRef(null);
    const blinkTimeoutRef = useRef(null);

    // Function to blink cells for a specific word
    const blinkWord = (word) => {
        // Clear any existing timeout
        if (blinkTimeoutRef.current) {
            clearTimeout(blinkTimeoutRef.current);
        }

        // Find the word in the words array to get its coordinates
        const wordData = words.find(w => w.word === word);
        if (!wordData) return;

        // Set the blinking cells
        setBlinkingCells(wordData.coords);

        // Remove the blinking after 1.5 seconds (3 blinks)
        blinkTimeoutRef.current = setTimeout(() => {
            setBlinkingCells([]);
        }, 1500);
    };

    // Expose the blink function to parent components
    useImperativeHandle(ref, () => ({
        blinkWord
    }));

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blinkTimeoutRef.current) {
                clearTimeout(blinkTimeoutRef.current);
            }
        };
    }, []);

    // Handle mouse and touch events for selecting cells
    const handleMouseDown = (r, c) => {
        if (disabled) return;
        isMouseDown.current = true;
        selectionStart.current = [r, c];
        lastDirection.current = null;
        setSelected([[r, c]]);
    };

    const handleMouseEnter = (r, c) => {
        if (disabled) return;
        if (!isMouseDown.current || !selectionStart.current) return;
        
        const start = selectionStart.current;
        const newDirection = getDirection(start, [r, c]);
        
        // If no valid direction, keep the current selection
        if (!newDirection) return;
        
        // Lock in direction on first valid movement, or continue with established direction
        if (!lastDirection.current) {
            lastDirection.current = newDirection;
        }
        
        // Continue selection in the established direction
        const dr = Math.sign(r - start[0]);
        const dc = Math.sign(c - start[1]);
        const length = Math.max(Math.abs(r - start[0]), Math.abs(c - start[1])) + 1;
        
        // Generate selection path
        const newSelected = Array.from({ length }, (_, i) => [start[0] + dr * i, start[1] + dc * i]);
        setSelected(newSelected);
    };

    // Global mouse move handler for continuing selection outside grid
    const handleGlobalMouseMove = (e) => {
        if (!isMouseDown.current || !selectionStart.current || !lastDirection.current) return;
        
        // Find the grid container
        const gridContainer = document.querySelector('[data-grid-container="true"]');
        if (!gridContainer) return;
        
        const rect = gridContainer.getBoundingClientRect();
        const cellSize = parseFloat(gridContainer.dataset.cellSize) || 40;
        const gap = 4;
        const padding = 4;
        
        // Calculate grid position from mouse coordinates
        const relativeX = e.clientX - rect.left - padding;
        const relativeY = e.clientY - rect.top - padding;
        
        const col = Math.round(relativeX / (cellSize + gap));
        const row = Math.round(relativeY / (cellSize + gap));
        
        // Continue selection using calculated position
        const start = selectionStart.current;
        
        // Calculate direction based on established direction
        let dr = 0, dc = 0;
        if (lastDirection.current === 'horizontal') {
            dr = 0;
            dc = col >= start[1] ? 1 : -1;
        } else if (lastDirection.current === 'vertical') {
            dr = row >= start[0] ? 1 : -1;
            dc = 0;
        } else if (lastDirection.current === 'diagonal') {
            dr = row >= start[0] ? 1 : -1;
            dc = col >= start[1] ? 1 : -1;
        }
        
        // Calculate selection length based on mouse position
        let length;
        if (lastDirection.current === 'horizontal') {
            length = Math.abs(col - start[1]) + 1;
        } else if (lastDirection.current === 'vertical') {
            length = Math.abs(row - start[0]) + 1;
        } else {
            length = Math.max(Math.abs(row - start[0]), Math.abs(col - start[1])) + 1;
        }
        
        // Generate selection, only including cells within grid bounds
        const newSelected = [];
        for (let i = 0; i < length; i++) {
            const newR = start[0] + dr * i;
            const newC = start[1] + dc * i;
            
            if (newR >= 0 && newR < grid.length && newC >= 0 && newC < grid[0].length) {
                newSelected.push([newR, newC]);
            }
        }
        
        if (newSelected.length > 0) {
            setSelected(newSelected);
        }
    };

    const handleMouseUp = () => {
        isMouseDown.current = false;
        selectionStart.current = null;
        lastDirection.current = null;
        
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
            handleMouseDown(...cell);
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault(); // Prevent scrolling during selection
        if (!isMouseDown.current || !selectionStart.current) return;
        
        const cell = getCellFromTouch(e);
        if (cell) {
            handleMouseEnter(...cell);
        } else if (lastDirection.current) {
            // If touch goes outside grid but we have a direction, use global handler
            handleGlobalMouseMove({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            });
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault(); // Prevent any default touch end behavior
        handleMouseUp();
    };

    // Add global mouse move tracking for extending selection outside grid
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isMouseDown.current) {
                handleMouseUp();
            }
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, []); // Empty dependency array since handlers use refs

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
                data-grid-container="true"
                data-cell-size={cellSize}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    // Only clear selection if mouse truly leaves and we're not in the middle of a selection
                    if (!isMouseDown.current) {
                        setSelected([]);
                    }
                }}
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
                    const isBlinking = blinkingCells.some(([br, bc]) => br === r && bc === c);
                    
                    return (
                        <ScrabbleGridCell
                            key={`${r}-${c}`}
                            r={r}
                            c={c}
                            cell={cell}
                            isFound={isFound(r, c)}
                            isBlinking={isBlinking}
                            isSelected={isSelected}
                            handleMouseDown={handleMouseDown}
                            handleMouseEnter={handleMouseEnter}
                            cellSize={cellSize}
                        />
                    );
                })}
            </Box>
        </Box>
    );
});

export default ScrabbleGrid;
