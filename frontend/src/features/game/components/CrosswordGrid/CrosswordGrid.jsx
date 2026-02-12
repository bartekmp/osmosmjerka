import Box from '@mui/material/Box';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState, useRef } from 'react';
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
    isLoading = false // Loading state
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
    const [_currentHintPhrase, setCurrentHintPhrase] = useState(null); // Keep for legacy/external compatibility if needed
    const [_hintLevel, setHintLevel] = useState(0); // Keep for legacy

    // New: Track hint level per phrase index
    const [phraseHintLevels, setPhraseHintLevels] = useState({});
    // New: Blinking phrase for visual feedback
    const [blinkingPhrase, setBlinkingPhrase] = useState(null);
    const blinkingTimeoutRef = useRef(null);

    // Transient wrong cells for Level 2 hint (pulsating highlight)
    const [transientWrongCells, setTransientWrongCells] = useState(new Set());
    const transientTimeoutRef = useRef(null);

    const gridSize = grid.length;
    const cellSize = useGridSize(gridSize, isTouchDevice, useMobileLayout);

    // Reset when grid changes
    useEffect(() => {
        setUserInputs({});
        setActiveCell(null);
        setCompletedPhrases(new Set());
        setWrongPhrases(new Set());
        setCurrentHintPhrase(null);
        setHintLevel(0);
        setPhraseHintLevels({});
        setBlinkingPhrase(null);
        setTransientWrongCells(new Set());
        if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
        if (blinkingTimeoutRef.current) clearTimeout(blinkingTimeoutRef.current);
    }, [grid]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
            if (blinkingTimeoutRef.current) clearTimeout(blinkingTimeoutRef.current);
        };
    }, []);

    // Helper to normalize characters for comparison (diacritic tolerance)
    const normalizeChar = (char) => {
        if (!char) return '';
        const map = {
            'Č': 'C', 'Ć': 'C', 'Đ': 'D', 'Š': 'S', 'Ž': 'Z',
            'Ą': 'A', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
        };
        const c = char.toUpperCase();
        return map[c] || c;
    };

    // Replace user inputs with correct phrase characters (restoring diacritics)
    const fillCorrectPhrase = useCallback((phrase) => {
        const newInputs = { ...userInputs };
        const cleanPhrase = phrase.phrase.replace(/\s/g, '').toUpperCase();

        phrase.coords.forEach(([r, c], i) => {
            newInputs[`${r},${c}`] = cleanPhrase[i];
        });

        setUserInputs(newInputs);
    }, [userInputs]);

    // Get phrase at a specific cell position
    const getPhrasesAtCell = useCallback((row, col) => {
        return phrases.filter(p =>
            p.coords.some(([r, c]) => r === row && c === col)
        );
    }, [phrases]);

    // Advance to next cell in current direction
    const advanceToNextCell = useCallback((row, col) => {
        const phrasesHere = getPhrasesAtCell(row, col);
        // Find phrase matching current direction
        const currentPhrase = phrasesHere.find(p => p.direction === currentDirection) || phrasesHere[0];

        if (!currentPhrase) return;

        const coords = currentPhrase.coords;
        const currentIdx = coords.findIndex(([r, c]) => r === row && c === col);

        if (currentIdx >= 0 && currentIdx < coords.length - 1) {
            // Find next editable cell (skip locked/completed cells)
            let nextIdx = currentIdx + 1;
            while (nextIdx < coords.length) {
                const [r, c] = coords[nextIdx];
                // Check if this cell is locked (part of any completed phrase)
                const isLocked = getPhrasesAtCell(r, c).some(p => completedPhrases.has(phrases.indexOf(p)));

                if (!isLocked) {
                    setActiveCell([r, c]);
                    return;
                }
                nextIdx++;
            }
        }
    }, [currentDirection, getPhrasesAtCell, completedPhrases, phrases]);

    // Check if a phrase is fully filled
    const isPhraseFullyFilled = useCallback((phrase) => {
        return phrase.coords.every(([r, c]) => {
            const key = `${r},${c}`;
            return userInputs[key] && userInputs[key].length > 0;
        });
    }, [userInputs]);

    // Check if a phrase is correct
    const isPhraseCorrect = useCallback((phrase) => {
        const normalizedPhrase = phrase.phrase.replace(/\s/g, '').toUpperCase().split('').map(normalizeChar).join('');
        const userWord = phrase.coords.map(([r, c]) => normalizeChar(userInputs[`${r},${c}`] || '')).join('');
        return userWord === normalizedPhrase;
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
                    // We can't easily call fillCorrectPhrase here because we are in a loop and it updates state
                    // Ideally we should batch updates, but for now we rely on the side effect that correct phrases are locked
                    // However, we should ensure the display shows correct diacritics.
                    // Since we can't call fillCorrectPhrase inside loop without complex refactoring,
                    // we'll leave it for now. User input will remain as is until next render?
                    // Actually, let's just trigger the callback.
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
        const newUserInputs = {
            ...userInputs,
            [key]: char
        };
        setUserInputs(newUserInputs);

        // Validate immediately with new inputs to trigger found animation before cursor moves
        // We need to check synchronously if any phrase is now complete
        phrases.forEach((phrase, idx) => {
            if (completedPhrases.has(idx)) return; // Already completed

            // Check if phrase is fully filled with new input
            const isFilled = phrase.coords.every(([r, c]) => {
                const k = `${r},${c}`;
                return newUserInputs[k] && newUserInputs[k].length > 0;
            });

            if (isFilled) {
                // Check if correct (with normalization)
                const normalizedPhrase = phrase.phrase.replace(/\s/g, '').toUpperCase().split('').map(normalizeChar).join('');
                const userWord = phrase.coords.map(([r, c]) => normalizeChar(newUserInputs[`${r},${c}`] || '')).join('');

                if (userWord === normalizedPhrase) {
                    setCompletedPhrases(prev => new Set([...prev, idx]));
                    // Remove from wrong phrases if it was there
                    setWrongPhrases(prev => {
                        const next = new Set(prev);
                        next.delete(idx);
                        return next;
                    });
                    // AUTO-CORRECT: Replace user input with actual phrase characters (restores diacritics)
                    fillCorrectPhrase(phrase);
                    onPhraseComplete?.(phrase);
                } else if (showWrongHighlight) {
                    setWrongPhrases(prev => new Set([...prev, idx]));
                    onPhraseWrong?.(phrase);
                }
            } else {
                // Phrase is no longer fully filled - clear wrong highlight if present
                setWrongPhrases(prev => {
                    if (prev.has(idx)) {
                        const next = new Set(prev);
                        next.delete(idx);
                        return next;
                    }
                    return prev;
                });
            }
        });

        // If a character was entered, advance to next cell
        if (char) {
            advanceToNextCell(row, col);
        }
    }, [disabled, userInputs, phrases, completedPhrases, showWrongHighlight, onPhraseComplete, onPhraseWrong, advanceToNextCell]);



    // Handle cell focus
    const handleCellFocus = useCallback((row, col) => {
        const phrasesHere = getPhrasesAtCell(row, col);
        const isSameCell = activeCell && activeCell[0] === row && activeCell[1] === col;
        const isIntersection = phrasesHere.length > 1;

        // If clicking the same cell at an intersection, toggle direction
        if (isSameCell && isIntersection) {
            const newDirection = currentDirection === 'across' ? 'down' : 'across';
            // Only toggle if the new direction is available at this cell
            if (phrasesHere.some(p => p.direction === newDirection)) {
                setCurrentDirection(newDirection);
            }
            return; // Don't change activeCell, just toggle direction
        }

        setActiveCell([row, col]);

        // Determine direction based on available phrases
        if (phrasesHere.length === 1) {
            // Only one phrase - must use its direction
            setCurrentDirection(phrasesHere[0].direction);
        } else if (phrasesHere.length > 1) {
            // Multiple phrases (intersection) - keep current direction if valid
            const hasCurrentDirection = phrasesHere.some(p => p.direction === currentDirection);
            if (!hasCurrentDirection) {
                // Current direction not available here, switch to first available
                setCurrentDirection(phrasesHere[0].direction);
            }
            // Otherwise keep currentDirection unchanged
        }
    }, [getPhrasesAtCell, currentDirection, activeCell]);

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
                        // Move backwards skipping locked cells
                        let prevIdx = currentIdx - 1;
                        while (prevIdx >= 0) {
                            const [prevR, prevC] = coords[prevIdx];
                            // Check if locked
                            const isLocked = getPhrasesAtCell(prevR, prevC).some(p => completedPhrases.has(phrases.indexOf(p)));

                            if (!isLocked) {
                                setActiveCell([prevR, prevC]);
                                return;
                            }
                            prevIdx--;
                        }
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

            // Immediately mark as completed (since we know it's correct)
            const idx = phrases.indexOf(targetPhrase);
            if (idx !== -1) {
                setCompletedPhrases(prev => new Set([...prev, idx]));
                onPhraseComplete?.(targetPhrase);
            }
        }

        onHintUsed?.(targetPhrase.phrase);
        return targetPhrase;
    }, [phrases, completedPhrases, userInputs, onHintUsed, validatePhrases]);

    // Progressive hint methods (matching ScrabbleGrid interface for App.jsx compatibility)
    const showProgressiveHint = useCallback((isProgressive = true) => {
        // Find uncompleted phrases
        const uncompletedPhrases = phrases.filter((p, idx) => !completedPhrases.has(idx));
        if (uncompletedPhrases.length === 0) return null;

        // Select target: prioritize active phrase if uncompleted, otherwise random
        let targetPhrase = null;
        if (activeCell) {
            const activePhrase = phrases.find(p =>
                p.direction === currentDirection &&
                p.coords.some(([r, c]) => r === activeCell[0] && c === activeCell[1])
            );
            if (activePhrase && !completedPhrases.has(phrases.indexOf(activePhrase))) {
                targetPhrase = activePhrase;
            }
        }

        if (!targetPhrase) {
            targetPhrase = uncompletedPhrases[Math.floor(Math.random() * uncompletedPhrases.length)];
        }

        const phraseIdx = phrases.indexOf(targetPhrase);
        const normalized = targetPhrase.phrase.replace(/\s/g, '').toUpperCase();

        if (isProgressive) {
            // Always reveal next missing character
            // Find first missing cell
            const firstMissing = targetPhrase.coords.find(([r, c]) => !userInputs[`${r},${c}`]);

            if (firstMissing) {
                const [r, c] = firstMissing;
                const charIdx = targetPhrase.coords.findIndex(([pr, pc]) => pr === r && pc === c);
                setUserInputs(prev => ({ ...prev, [`${r},${c}`]: normalized[charIdx] }));

                // Update hint level for this phrase
                const currentLevel = phraseHintLevels[phraseIdx] || 0;
                setPhraseHintLevels(prev => ({
                    ...prev,
                    [phraseIdx]: currentLevel + 1
                }));

                // Auto-focus next empty cell after revealing this one
                const nextMissing = targetPhrase.coords.find(([nr, nc]) =>
                    !userInputs[`${nr},${nc}`] && (nr !== r || nc !== c)
                );

                if (nextMissing) {
                    const [nextR, nextC] = nextMissing;
                    // Set active cell - CrosswordCell will auto-focus via useEffect
                    setTimeout(() => {
                        setActiveCell([nextR, nextC]);
                    }, 100);
                }
            }

            onHintUsed?.(targetPhrase.phrase);
            return targetPhrase;
        } else {
            // Classic mode
            return showHint(1);
        }
    }, [phrases, completedPhrases, activeCell, currentDirection, userInputs, phraseHintLevels, showHint, onHintUsed]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        showHint,
        showProgressiveHint,
        clearHints: () => {
            // Reset hint tracking state
            setCurrentHintPhrase(null);
            setHintLevel(0);
            setPhraseHintLevels({});
            // Optionally clear Blink?
            setBlinkingPhrase(null);
        },
        // Focus on a specific phrase (for clue list click)
        focusPhrase: (phraseText) => {
            const phrase = phrases.find(p => p.phrase === phraseText);
            if (!phrase) return;

            // Find first missing (unfilled) cell in the phrase
            const firstMissingCoord = phrase.coords.find(([r, c]) => !userInputs[`${r},${c}`]);
            const targetCoord = firstMissingCoord || phrase.coords[0];

            setCurrentDirection(phrase.direction);
            setActiveCell(targetCoord);

            // Blink the phrase
            setBlinkingPhrase(phrase);
            if (blinkingTimeoutRef.current) clearTimeout(blinkingTimeoutRef.current);
            blinkingTimeoutRef.current = setTimeout(() => {
                setBlinkingPhrase(null);
            }, 1500); // 3 blinks of 0.4s = 1.2s. 1.5s is safe.
        },
        getCompletedCount: () => completedPhrases.size,
        getTotalPhrases: () => phrases.length,
        isAllComplete: () => completedPhrases.size === phrases.length,
    }), [showHint, showProgressiveHint, completedPhrases, phrases, userInputs]);

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

        // Find start numbers if this is a phrase start
        const startNumbers = [];
        phrases.forEach(p => {
            if (p.coords[0][0] === row && p.coords[0][1] === col && p.start_number) {
                startNumbers.push(p.start_number);
            }
        });
        const startNumber = startNumbers.length > 0 ? startNumbers.join('/') : null;

        // If loading, return minimalist blank cell
        if (isLoading) {
            return {
                letter: '',
                userInput: '',
                startNumber: null,
                isActive: false,
                isDisabled: true,
                isCorrect: false,
                isWrong: false,
                isPulsating: false,
                isHighlighted: false,
                isBlinking: false,
                cursorDirection: null,
            };
        }

        // Check if cell is in a completed phrase
        const phrasesHere = getPhrasesAtCell(row, col);
        const isInCompletedPhrase = phrasesHere.some((p) =>
            phrases.findIndex(pp => pp === p) !== -1 &&
            completedPhrases.has(phrases.findIndex(pp => pp === p))
        );

        // Check if cell is in the active phrase (highlighting)
        let isHighlighted = false;
        if (activeCell && !isInCompletedPhrase) {
            // Find the phrase that matches activeCell and currentDirection
            const activePhrase = phrases.find(p =>
                p.direction === currentDirection &&
                p.coords.some(([r, c]) => r === activeCell[0] && c === activeCell[1])
            );

            // If we have an active phrase, check if this cell is part of it
            if (activePhrase) {
                isHighlighted = activePhrase.coords.some(([r, c]) => r === row && c === col);
            } else {
                // Fallback: if no phrase matches direction (shouldn't happen often), highlights row/col?
                // For now, only highlight if part of the active phrase
            }
        }

        const isInWrongPhrase = phrasesHere.some(p =>
            wrongPhrases.has(phrases.findIndex(pp => pp === p))
        );

        const isTransientWrong = transientWrongCells.has(key);
        const isActive = activeCell && activeCell[0] === row && activeCell[1] === col;

        // Blink check
        let isBlinking = false;
        if (blinkingPhrase) {
            isBlinking = blinkingPhrase.coords.some(([r, c]) => r === row && c === col);
        }

        return {
            letter: cellData?.letter || '',
            userInput: userInputs[key] || '',
            startNumber,
            isActive,
            isDisabled: isInCompletedPhrase,
            isCorrect: isInCompletedPhrase,
            isWrong: (isInWrongPhrase && showWrongHighlight) || isTransientWrong,
            isPulsating: isTransientWrong,
            isHighlighted: isHighlighted, // Also highlight active cell to keep phrase visual continuity
            isBlinking,
            cursorDirection: isActive ? currentDirection : null, // Pass direction for cursor orientation
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
