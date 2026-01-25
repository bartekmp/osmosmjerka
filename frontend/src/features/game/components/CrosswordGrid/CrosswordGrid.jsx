import Box from '@mui/material/Box';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGridSize } from '../Grid/hooks';
import CrosswordCell from './CrosswordCell';
import './CrosswordGrid.css';

/**
 * CrosswordGrid - Main crossword puzzle grid component
 * 
 * Unlike ScrabbleGrid (drag-to-select), this uses:
 * - Individual cell text inputs
 * - Keyboard navigation between cells
 * - Phrase validation with visual feedback
 */
const CrosswordGrid = forwardRef(({
    grid,                    // 2D array with cell metadata from backend
    phrases,                 // Array of phrase objects with coords, direction, start_number
    onPhraseComplete,        // Called when a phrase is correctly completed
    onPhraseWrong,           // Called when a filled phrase is incorrect
    disabled = false,
    isDarkMode = false,
    _showCelebration = false,
    showWrongHighlight = false, // Setting to highlight wrong phrases in red
    onHintUsed = null,
    isTouchDevice = false,
    useMobileLayout = false,
}, ref) => {
    const { t } = useTranslation();

    // User input state - maps "row,col" to character
    const [userInputs, setUserInputs] = useState({});
    // Currently active cell [row, col]
    const [activeCell, setActiveCell] = useState(null);
    // Current direction for navigation: 'across' or 'down'
    const [currentDirection, setCurrentDirection] = useState('across');
    // Completed phrase indices
    const [completedPhrases, setCompletedPhrases] = useState(new Set());
    // Wrong phrase indices (for highlighting)
    const [wrongPhrases, setWrongPhrases] = useState(new Set());
    // Celebration cells (for future use)
    const [_celebrationCells, _setCelebrationCells] = useState([]);

    const gridSize = grid.length;
    const cellSize = useGridSize(gridSize, isTouchDevice, useMobileLayout);

    // Reset when grid changes
    useEffect(() => {
        setUserInputs({});
        setActiveCell(null);
        setCompletedPhrases(new Set());
        setWrongPhrases(new Set());
    }, [grid]);

    // Get phrase at a specific cell position
    const getPhrasesAtCell = useCallback((row, col) => {
        return phrases.filter(p =>
            p.coords.some(([r, c]) => r === row && c === col)
        );
    }, [phrases]);

    // Check if a phrase is fully filled
    const isPhraseFullyFilled = useCallback((phrase) => {
        return phrase.coords.every(([r, c]) => {
            const key = `${r},${c}`;
            return userInputs[key] && userInputs[key].length > 0;
        });
    }, [userInputs]);

    // Check if a phrase is correct
    const isPhraseCorrect = useCallback((phrase) => {
        const normalized = phrase.phrase.replace(/\s/g, '').toUpperCase();
        const userWord = phrase.coords.map(([r, c]) => userInputs[`${r},${c}`] || '').join('');
        return userWord === normalized;
    }, [userInputs]);

    // Validate all phrases and trigger callbacks
    const validatePhrases = useCallback(() => {
        const newCompleted = new Set(completedPhrases);
        const newWrong = new Set();

        phrases.forEach((phrase, idx) => {
            if (completedPhrases.has(idx)) return; // Already completed

            if (isPhraseFullyFilled(phrase)) {
                if (isPhraseCorrect(phrase)) {
                    newCompleted.add(idx);
                    onPhraseComplete?.(phrase);
                } else if (showWrongHighlight) {
                    newWrong.add(idx);
                    onPhraseWrong?.(phrase);
                }
            }
        });

        setCompletedPhrases(newCompleted);
        setWrongPhrases(newWrong);
    }, [phrases, completedPhrases, isPhraseFullyFilled, isPhraseCorrect, showWrongHighlight, onPhraseComplete, onPhraseWrong]);

    // Handle cell input
    const handleCellInput = useCallback((row, col, char) => {
        if (disabled) return;

        const key = `${row},${col}`;
        setUserInputs(prev => ({
            ...prev,
            [key]: char
        }));

        // If a character was entered, advance to next cell
        if (char) {
            advanceToNextCell(row, col);
        }

        // Trigger validation after state update
        setTimeout(validatePhrases, 0);
    }, [disabled, validatePhrases]);

    // Advance to next cell in current direction
    const advanceToNextCell = useCallback((row, col) => {
        const phrasesHere = getPhrasesAtCell(row, col);
        // Find phrase matching current direction
        const currentPhrase = phrasesHere.find(p => p.direction === currentDirection) || phrasesHere[0];

        if (!currentPhrase) return;

        const coords = currentPhrase.coords;
        const currentIdx = coords.findIndex(([r, c]) => r === row && c === col);

        if (currentIdx >= 0 && currentIdx < coords.length - 1) {
            const [nextR, nextC] = coords[currentIdx + 1];
            setActiveCell([nextR, nextC]);
        }
    }, [currentDirection, getPhrasesAtCell]);

    // Handle cell focus
    const handleCellFocus = useCallback((row, col) => {
        setActiveCell([row, col]);

        // Determine direction based on available phrases
        const phrasesHere = getPhrasesAtCell(row, col);
        if (phrasesHere.length === 1) {
            setCurrentDirection(phrasesHere[0].direction);
        }
    }, [getPhrasesAtCell]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((row, col, key) => {
        if (disabled) return;

        let newRow = row;
        let newCol = col;

        switch (key) {
            case 'ArrowUp':
                newRow = Math.max(0, row - 1);
                setCurrentDirection('down');
                break;
            case 'ArrowDown':
                newRow = Math.min(gridSize - 1, row + 1);
                setCurrentDirection('down');
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, col - 1);
                setCurrentDirection('across');
                break;
            case 'ArrowRight':
            case 'Tab':
                newCol = Math.min(gridSize - 1, col + 1);
                setCurrentDirection('across');
                break;
            case 'Enter':
                // Toggle direction
                setCurrentDirection(prev => prev === 'across' ? 'down' : 'across');
                return;
            case 'Backspace': {
                // Move back in current direction
                const phrasesHere = getPhrasesAtCell(row, col);
                const currentPhrase = phrasesHere.find(p => p.direction === currentDirection) || phrasesHere[0];
                if (currentPhrase) {
                    const coords = currentPhrase.coords;
                    const currentIdx = coords.findIndex(([r, c]) => r === row && c === col);
                    if (currentIdx > 0) {
                        const [prevR, prevC] = coords[currentIdx - 1];
                        setActiveCell([prevR, prevC]);
                    }
                }
                return;
            }
            default:
                return;
        }

        // Find next valid cell (skip blanks)
        while (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
            if (grid[newRow]?.[newCol] !== null) {
                setActiveCell([newRow, newCol]);
                break;
            }
            // Continue in same direction
            if (key === 'ArrowUp') newRow--;
            else if (key === 'ArrowDown') newRow++;
            else if (key === 'ArrowLeft') newCol--;
            else newCol++;
        }
    }, [disabled, gridSize, grid, currentDirection, getPhrasesAtCell]);

    // Hint methods
    const showHint = useCallback((level = 1) => {
        // Find uncompleted phrase
        const uncompletedPhrases = phrases.filter((p, idx) => !completedPhrases.has(idx));
        if (uncompletedPhrases.length === 0) return null;

        const targetPhrase = uncompletedPhrases[Math.floor(Math.random() * uncompletedPhrases.length)];
        const normalized = targetPhrase.phrase.replace(/\s/g, '').toUpperCase();

        if (level === 1) {
            // First letter
            const [r, c] = targetPhrase.coords[0];
            setUserInputs(prev => ({ ...prev, [`${r},${c}`]: normalized[0] }));
        } else if (level === 2) {
            // Random letter
            const coords = targetPhrase.coords;
            const emptyCoords = coords.filter(([r, c]) => !userInputs[`${r},${c}`]);
            if (emptyCoords.length > 0) {
                const [r, c] = emptyCoords[Math.floor(Math.random() * emptyCoords.length)];
                const idx = coords.findIndex(([cr, cc]) => cr === r && cc === c);
                setUserInputs(prev => ({ ...prev, [`${r},${c}`]: normalized[idx] }));
            }
        } else if (level === 3) {
            // Full phrase
            const newInputs = { ...userInputs };
            targetPhrase.coords.forEach(([r, c], i) => {
                newInputs[`${r},${c}`] = normalized[i];
            });
            setUserInputs(newInputs);
            setTimeout(validatePhrases, 0);
        }

        onHintUsed?.(targetPhrase.phrase);
        return targetPhrase;
    }, [phrases, completedPhrases, userInputs, onHintUsed, validatePhrases]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        showHint,
        clearHints: () => {
            // No-op for crossword - hints directly modify userInputs which are persistent
            // This is called by App.jsx when a phrase is found
        },
        getCompletedCount: () => completedPhrases.size,
        getTotalPhrases: () => phrases.length,
        isAllComplete: () => completedPhrases.size === phrases.length,
    }), [showHint, completedPhrases, phrases]);

    // Early return for empty grid
    if (gridSize === 0) {
        return <Box sx={{ p: 2, textAlign: 'center' }}>{t('no_puzzle_available')}</Box>;
    }

    // Build cell props map
    const getCellProps = (row, col) => {
        const cellData = grid[row]?.[col];
        const key = `${row},${col}`;
        const isBlank = cellData === null;

        if (isBlank) {
            return { isBlank: true };
        }

        // Find start number if this is a phrase start
        let startNumber = null;
        phrases.forEach(p => {
            if (p.coords[0][0] === row && p.coords[0][1] === col) {
                startNumber = p.start_number;
            }
        });

        // Check if cell is in a completed phrase
        const phrasesHere = getPhrasesAtCell(row, col);
        const isInCompletedPhrase = phrasesHere.some((p) =>
            phrases.findIndex(pp => pp === p) !== -1 &&
            completedPhrases.has(phrases.findIndex(pp => pp === p))
        );

        // Check if cell is in a wrong phrase
        const isInWrongPhrase = phrasesHere.some(p =>
            wrongPhrases.has(phrases.findIndex(pp => pp === p))
        );

        return {
            letter: cellData?.letter || '',
            userInput: userInputs[key] || '',
            startNumber,
            isActive: activeCell && activeCell[0] === row && activeCell[1] === col,
            isDisabled: isInCompletedPhrase,
            isCorrect: isInCompletedPhrase,
            isWrong: isInWrongPhrase && showWrongHighlight,
        };
    };

    const totalGridSize = gridSize * cellSize + (gridSize + 1) * 4;

    return (
        <Box className="grid-wrapper">
            <Box
                className={`crossword-grid-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
                    gap: '2px',
                    padding: '8px',
                    width: `${totalGridSize}px`,
                    height: `${totalGridSize}px`,
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                }}
            >
                {grid.flat().map((cellData, index) => {
                    const row = Math.floor(index / gridSize);
                    const col = index % gridSize;
                    const props = getCellProps(row, col);

                    return (
                        <CrosswordCell
                            key={`${row}-${col}`}
                            row={row}
                            col={col}
                            {...props}
                            onInput={handleCellInput}
                            onFocus={handleCellFocus}
                            onKeyDown={handleKeyDown}
                            cellSize={cellSize}
                        />
                    );
                })}
            </Box>
        </Box>
    );
});

export default CrosswordGrid;
