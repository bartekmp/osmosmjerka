import Box from '@mui/material/Box';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Grid.css';
import ScrabbleGridCell from './GridCell';
import './GridContainer.css';
import { GridSelection, findMatchingWord, generateMexicanWave } from './gridUtils';
import { getDirection, isStraightLine } from './helpers';
import { useGridSize, useMouseSelection } from './hooks';
import { useMovementHandlers } from './movementHandlers';

const ScrabbleGrid = forwardRef(({
    grid,
    words,
    found,
    onFound,
    disabled = false,
    isDarkMode = false,
    showCelebration = false
}, ref) => {
    const { t } = useTranslation();

    // State management - MUST be called before any conditional returns
    const [selected, setSelected] = useState([]);
    const [blinkingCells, setBlinkingCells] = useState([]);
    const [celebrationCells, setCelebrationCells] = useState([]);
    const [, forceRender] = useState(0);

    // Custom hooks - MUST be called before any conditional returns
    const { isMouseDown, selectionStart, lastDirection, startSelection, endSelection } = useMouseSelection();
    const cellSize = useGridSize(grid.length);

    // Refs for cleanup - MUST be called before any conditional returns
    const blinkTimeoutRef = useRef(null);
    const celebrationTimeoutRef = useRef(null);

    // Calculate gridSize before using it in callbacks
    const gridSize = grid.length;

    // Animation methods
    const startMexicanWave = useCallback(() => {
        if (gridSize === 0) return;

        // Clear any existing celebration
        if (celebrationTimeoutRef.current) {
            clearTimeout(celebrationTimeoutRef.current);
        }
        setCelebrationCells([]);

        const cellsWithDistance = generateMexicanWave(gridSize);
        const waveWidth = 4;
        const delayBetweenSteps = 40;
        let currentStep = 0;
        const totalSteps = Math.ceil(cellsWithDistance.length / 2) + waveWidth;

        const animateStep = () => {
            const startIndex = Math.max(0, currentStep * 2 - waveWidth);
            const endIndex = Math.min(cellsWithDistance.length, currentStep * 2 + waveWidth);
            const activeCells = cellsWithDistance.slice(startIndex, endIndex).map(cell => [cell.row, cell.col]);

            setCelebrationCells(activeCells);
            currentStep++;

            if (currentStep < totalSteps) {
                celebrationTimeoutRef.current = setTimeout(animateStep, delayBetweenSteps);
            } else {
                celebrationTimeoutRef.current = setTimeout(() => {
                    setCelebrationCells([]);
                }, delayBetweenSteps * 2);
            }
        };

        celebrationTimeoutRef.current = setTimeout(animateStep, 1000);
    }, [gridSize]);

    const blinkWord = useCallback((word) => {
        if (blinkTimeoutRef.current) {
            clearTimeout(blinkTimeoutRef.current);
        }

        const wordData = words.find(w => w.word === word);
        if (!wordData) return;

        setBlinkingCells([]);
        setTimeout(() => {
            setBlinkingCells(wordData.coords);
            blinkTimeoutRef.current = setTimeout(() => {
                setBlinkingCells([]);
            }, 1500);
        }, 10);
    }, [words]);

    // Selection methods
    const updateSelection = useCallback((targetRow, targetCol) => {
        if (!selectionStart.current) return;

        const start = selectionStart.current;
        const newDirection = getDirection(start, [targetRow, targetCol]);

        if (!newDirection) return;

        lastDirection.current = newDirection;
        const selectionPath = GridSelection.generateSelectionPath(start, [targetRow, targetCol]);
        const validSelection = GridSelection.filterValidCells(selectionPath, gridSize);

        if (validSelection.length > 0) {
            setSelected(validSelection);
        }
    }, [gridSize]);

    const handleWordMatch = useCallback(() => {
        if (!isStraightLine(selected)) {
            setSelected([]);
            return;
        }

        const matchedWord = findMatchingWord(selected, words);
        if (matchedWord) {
            onFound(matchedWord.word);
        }
        setSelected([]);
    }, [selected, words, onFound]);

    // Movement handlers
    const movementHandlers = useMovementHandlers({
        disabled,
        isMouseDown,
        selectionStart,
        lastDirection,
        startSelection,
        endSelection,
        updateSelection,
        handleWordMatch,
        gridSize,
        selected,
        setSelected
    });

    const {
        handleMouseDown,
        handleMouseEnter,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleGlobalMouseMove
    } = movementHandlers;

    // Utility functions
    const isCelebrating = useCallback((r, c) => {
        return celebrationCells.some(([cr, cc]) => cr === r && cc === c);
    }, [celebrationCells]);

    const isFound = useCallback((r, c) => {
        return words.some(w =>
            found.includes(w.word) &&
            w.coords.some(([wr, wc]) => wr === r && wc === c)
        );
    }, [words, found]);

    // Effect hooks
    useEffect(() => {
        if (showCelebration && gridSize > 0) {
            startMexicanWave();
        }
        return () => {
            if (celebrationTimeoutRef.current) {
                clearTimeout(celebrationTimeoutRef.current);
            }
        };
    }, [showCelebration, startMexicanWave]);

    useEffect(() => {
        const handleResize = () => {
            setSelected([]);
            forceRender(prev => prev + 1);
        };

        const handleGlobalMouseUp = () => {
            if (isMouseDown.current) {
                handleMouseUp();
            }
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
            if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleMouseUp]);

    // Expose blink function to parent
    useImperativeHandle(ref, () => ({
        blinkWord
    }), [blinkWord]);

    // Early return for empty grid - AFTER all hooks have been called
    if (gridSize === 0) {
        return <Box sx={{ p: 2, textAlign: 'center' }}>{t('no_puzzle_available')}</Box>;
    }

    // Calculate grid dimensions
    const totalGridSize = gridSize * cellSize + (gridSize + 1) * 4;

    // Render grid
    return (
        <Box className="grid-wrapper">
            <Box
                data-grid-container="true"
                data-cell-size={cellSize}
                className={`grid-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    if (!isMouseDown.current) {
                        setSelected([]);
                    }
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
                    gap: '4px',
                    padding: '4px',
                    width: `${totalGridSize}px`,
                    height: `${totalGridSize}px`,
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                }}
            >
                {grid.flat().map((cell, index) => {
                    const r = Math.floor(index / gridSize);
                    const c = index % gridSize;

                    return (
                        <ScrabbleGridCell
                            key={`${r}-${c}`}
                            r={r}
                            c={c}
                            cell={cell}
                            isFound={isFound(r, c)}
                            isBlinking={blinkingCells.some(([br, bc]) => br === r && bc === c)}
                            isSelected={selected.some(([sr, sc]) => sr === r && sc === c)}
                            isCelebrating={isCelebrating(r, c)}
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
