import Box from '@mui/material/Box';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Grid.css';
import ScrabbleGridCell from './GridCell';
import './GridContainer.css';
import { GridSelection, findMatchingPhrase, generateMexicanWave } from './gridUtils';
import { getDirection, isStraightLine } from './helpers';
import { useGridSize, useMouseSelection } from './hooks';
import { useMovementHandlers } from './movementHandlers';

const HINT_DISPLAY_DURATION_MS = 5000;

const ScrabbleGrid = forwardRef(({
    grid,
    phrases,
    found,
    onFound,
    disabled = false,
    isDarkMode = false,
    showCelebration = false,
    onHintUsed = null
}, ref) => {
    const { t } = useTranslation();

    // State management - MUST be called before any conditional returns
    const [selected, setSelected] = useState([]);
    const [blinkingCells, setBlinkingCells] = useState([]);
    const [celebrationCells, setCelebrationCells] = useState([]);
    const [, forceRender] = useState(0);
    
    // Progressive hint states
    const [hintState, setHintState] = useState({
        targetPhrase: null,
        hintLevel: 0, // 0: no hint, 1: first letter, 2: direction arrow, 3: full outline
        hintCells: [],
        directionArrow: null
    });

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
                setTimeout(animateStep, delayBetweenSteps);
            } else {
                setTimeout(() => {
                    setCelebrationCells([]);
                }, delayBetweenSteps * 2);
            }
        };

        animateStep();
    }, [gridSize]);

    const blinkPhrase = useCallback((phrase) => {
        if (blinkTimeoutRef.current) {
            clearTimeout(blinkTimeoutRef.current);
        }

        const phraseData = phrases.find(p => p.phrase === phrase);
        if (!phraseData) return;

        setBlinkingCells([]);
        setTimeout(() => {
            setBlinkingCells(phraseData.coords);
            blinkTimeoutRef.current = setTimeout(() => {
                setBlinkingCells([]);
            }, HINT_DISPLAY_DURATION_MS);
        }, 10);
    }, [phrases]);

    // Progressive hint methods
    const showProgressiveHint = useCallback((isProgressiveMode = false) => {
        // Clear any existing hints
        setHintState({
            targetPhrase: null,
            hintLevel: 0,
            hintCells: [],
            directionArrow: null
        });

        // Find a random phrase that hasn't been found yet
        const availablePhrases = phrases.filter(p => !found.includes(p.phrase));
        if (availablePhrases.length === 0) return null;

        const targetPhrase = availablePhrases[Math.floor(Math.random() * availablePhrases.length)];
        
        if (isProgressiveMode) {
            // Progressive mode: start with first letter hint
            const firstCoord = targetPhrase.coords[0];
            setHintState(prev => ({
                ...prev,
                targetPhrase: targetPhrase,
                hintLevel: 1,
                hintCells: [firstCoord]
            }));
        } else {
            // Classic mode: show full phrase immediately
            setBlinkingCells([]);
            setTimeout(() => {
                setBlinkingCells(targetPhrase.coords);
                blinkTimeoutRef.current = setTimeout(() => {
                    setBlinkingCells([]);
                }, HINT_DISPLAY_DURATION_MS);
            }, 10);
        }

        // Notify parent component about hint usage
        if (onHintUsed) {
            onHintUsed(targetPhrase.phrase);
        }

        return targetPhrase;
    }, [phrases, found, onHintUsed]);

    const advanceProgressiveHint = useCallback(() => {
        setHintState(prev => {
            if (!prev.targetPhrase || prev.hintLevel >= 3) return prev;

            const newLevel = prev.hintLevel + 1;
            
            if (newLevel === 2) {
                // Show direction arrow
                const coords = prev.targetPhrase.coords;
                const startCoord = coords[0];
                const endCoord = coords[coords.length - 1];
                
                // Calculate direction
                const deltaRow = endCoord[0] - startCoord[0];
                const deltaCol = endCoord[1] - startCoord[1];
                
                let arrow = '→';
                if (deltaRow > 0 && deltaCol === 0) arrow = '↓';
                else if (deltaRow < 0 && deltaCol === 0) arrow = '↑';
                else if (deltaRow === 0 && deltaCol > 0) arrow = '→';
                else if (deltaRow === 0 && deltaCol < 0) arrow = '←';
                else if (deltaRow > 0 && deltaCol > 0) arrow = '↘';
                else if (deltaRow > 0 && deltaCol < 0) arrow = '↙';
                else if (deltaRow < 0 && deltaCol > 0) arrow = '↗';
                else if (deltaRow < 0 && deltaCol < 0) arrow = '↖';
                
                return {
                    ...prev,
                    hintLevel: newLevel,
                    directionArrow: { coord: startCoord, symbol: arrow }
                };
            } else if (newLevel === 3) {
                // Show full outline
                return {
                    ...prev,
                    hintLevel: newLevel,
                    hintCells: prev.targetPhrase.coords
                };
            }
            
            return prev;
        });
    }, []);

    const clearHints = useCallback(() => {
        setHintState({
            targetPhrase: null,
            hintLevel: 0,
            hintCells: [],
            directionArrow: null
        });
        setBlinkingCells([]);
    }, []);

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

    const handlePhraseMatch = useCallback(() => {
        if (!isStraightLine(selected)) {
            setSelected([]);
            return;
        }

        const matchedPhrase = findMatchingPhrase(selected, phrases);
        if (matchedPhrase) {
            onFound(matchedPhrase.phrase);
        }
        setSelected([]);
    }, [selected, phrases, onFound]);

    // Movement handlers
    const movementHandlers = useMovementHandlers({
        disabled,
        isMouseDown,
        selectionStart,
        lastDirection,
        startSelection,
        endSelection,
        updateSelection,
        handlePhraseMatch,
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
        return phrases.some(p =>
            found.includes(p.phrase) &&
            p.coords.some(([pr, pc]) => pr === r && pc === c)
        );
    }, [phrases, found]);

    // Effect hooks
    useEffect(() => {
        if (showCelebration && gridSize > 0) {
            startMexicanWave();
        }
    }, [showCelebration, gridSize, startMexicanWave]);

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

    // Expose blink function and hint methods to parent
    useImperativeHandle(ref, () => ({
        blinkPhrase,
        showProgressiveHint,
        advanceProgressiveHint,
        clearHints
    }), [blinkPhrase, showProgressiveHint, advanceProgressiveHint, clearHints]);

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

                    // Check if this cell is part of a hint
                    const isHintCell = hintState.hintCells.some(([hr, hc]) => hr === r && hc === c);
                    const hasDirectionArrow = hintState.directionArrow && 
                        hintState.directionArrow.coord[0] === r && 
                        hintState.directionArrow.coord[1] === c;

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
                            isHintCell={isHintCell}
                            directionArrow={hasDirectionArrow ? hintState.directionArrow.symbol : null}
                            hintLevel={hintState.hintLevel}
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
