import React, { useRef, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';

/**
 * CrosswordCell - A single cell in the crossword grid
 * 
 * Differences from GridCell:
 * - Supports text input (single character)
 * - Shows start number indicator for phrase beginnings
 * - Has different visual states: empty, filled, correct, wrong, disabled
 */
export default function CrosswordCell({
    row,
    col,
    _letter = '',        // The correct letter (hidden from user)
    userInput = '',     // What the user has typed
    startNumber = null, // Number shown in top-left if phrase starts here
    isActive = false,   // Currently focused/selected
    isDisabled = false, // Already solved, can't edit
    isBlank = false,    // Non-playable filler cell
    isCorrect = false,  // Phrase containing this cell is correct
    isWrong = false,    // Phrase containing this cell is wrong (highlight mode)
    isHighlighted = false, // Cell matches active phrase
    cursorDirection = null, // 'across' or 'down' for cursor orientation
    onInput,            // Called when user types a letter
    onFocus,            // Called when cell gains focus
    onKeyDown,          // Called for navigation keys
    cellSize = 40,
}) {
    const inputRef = useRef(null);

    // Focus input when cell becomes active
    useEffect(() => {
        if (isActive && inputRef.current && !isDisabled && !isBlank) {
            inputRef.current.focus();
        }
    }, [isActive, isDisabled, isBlank]);

    const handleChange = useCallback((e) => {
        if (isDisabled || isBlank) return;

        const value = e.target.value.toUpperCase();
        // Only allow single letter
        const newChar = value.slice(-1);
        if (newChar && /^[A-ZČĆŽŠĐ]$/.test(newChar)) {
            onInput?.(row, col, newChar);
        }
    }, [row, col, onInput, isDisabled, isBlank]);

    const handleKeyDown = useCallback((e) => {
        if (isDisabled || isBlank) return;

        // Handle backspace
        if (e.key === 'Backspace') {
            e.preventDefault();
            onInput?.(row, col, '');
            onKeyDown?.(row, col, 'Backspace');
            return;
        }

        // Handle navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
            e.preventDefault();
            onKeyDown?.(row, col, e.key);
        }
    }, [row, col, onInput, onKeyDown, isDisabled, isBlank]);

    const handleFocus = useCallback(() => {
        if (!isDisabled && !isBlank) {
            onFocus?.(row, col);
        }
    }, [row, col, onFocus, isDisabled, isBlank]);

    const handleClick = useCallback(() => {
        if (!isDisabled && !isBlank) {
            // Always call onFocus to enable toggle at intersections (even if already focused)
            onFocus?.(row, col);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [isDisabled, isBlank, onFocus, row, col]);

    // Generate CSS classes
    const getCellClasses = () => {
        const classes = ['crossword-cell'];
        if (isBlank) classes.push('blank');
        if (isActive) classes.push('active');
        if (isDisabled) classes.push('disabled');
        if (isCorrect) classes.push('correct');
        if (isWrong) classes.push('wrong', 'shake');
        if (isHighlighted) classes.push('highlighted');
        if (userInput) classes.push('filled');
        return classes.join(' ');
    };

    const fontSize = Math.max(cellSize * 0.55, 14);
    // Adjust number size if more than 2 digits/chars (e.g. 1/4)
    const isLongStartNumber = startNumber && String(startNumber).length > 2;
    const numberSize = isLongStartNumber ? Math.max(cellSize * 0.2, 7) : Math.max(cellSize * 0.25, 8);

    // Blank cells are just empty boxes
    if (isBlank) {
        return (
            <Box
                className={getCellClasses()}
                sx={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: 'transparent',
                }}
            />
        );
    }

    return (
        <Box
            className={getCellClasses()}
            onClick={handleClick}
            sx={{
                width: cellSize,
                height: cellSize,
                position: 'relative',
                cursor: isDisabled ? 'default' : 'text',
            }}
        >
            {/* Start number indicator */}
            {startNumber && (
                <Box
                    className="start-number"
                    sx={{
                        position: 'absolute',
                        top: '2px',
                        left: '3px',
                        fontSize: `${numberSize}px`,
                        fontWeight: 600,
                        lineHeight: 1,
                        color: 'var(--crossword-number-color, #666)',
                        userSelect: 'none',
                        zIndex: 1,
                    }}
                >
                    {startNumber}
                </Box>
            )}

            {/* Blinking cursor for active empty cell */}
            {isActive && !userInput && !isDisabled && (
                <Box className={`cursor ${cursorDirection === 'down' ? 'vertical' : 'horizontal'}`} />
            )}

            {/* Input field */}
            <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                disabled={isDisabled}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="crossword-input"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'center',
                    fontSize: `${fontSize}px`,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    caretColor: 'transparent',
                    outline: 'none',
                    padding: 0,
                    color: 'inherit',
                    cursor: isDisabled ? 'default' : 'text',
                }}
            />
        </Box>
    );
}
