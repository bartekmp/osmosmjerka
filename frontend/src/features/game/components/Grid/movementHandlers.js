import { useCallback } from 'react';
import { getCellFromTouch, getDirection } from './helpers';
import { GridSelection, CoordinateUtils } from './gridUtils';

/**
 * Custom hook for mouse and touch movement handlers
 * Manages all user interaction events for grid selection
 */
export const useMovementHandlers = ({
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
}) => {

    // Mouse event handlers
    const handleMouseDown = useCallback((r, c) => {
        if (disabled) return;
        startSelection(r, c);
        setSelected([[r, c]]);
    }, [disabled, startSelection, setSelected]);

    const handleMouseEnter = useCallback((r, c) => {
        if (disabled || !isMouseDown.current) return;
        updateSelection(r, c);
    }, [disabled, updateSelection, isMouseDown]);

    const handleMouseUp = useCallback(() => {
        if (!isMouseDown.current) return;
        endSelection();
        handleWordMatch();
    }, [endSelection, handleWordMatch, isMouseDown]);

    // Touch event handlers
    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        const cell = getCellFromTouch(e);
        if (cell) {
            handleMouseDown(...cell);
        }
    }, [handleMouseDown]);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        if (!isMouseDown.current || !selectionStart.current) return;

        const cell = getCellFromTouch(e);
        if (cell) {
            handleMouseEnter(...cell);
        }
    }, [handleMouseEnter, isMouseDown, selectionStart]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        handleMouseUp();
    }, [handleMouseUp]);

    // Global mouse tracking for extending selection outside grid
    const handleGlobalMouseMove = useCallback((e) => {
        if (!isMouseDown.current || !selectionStart.current) return;

        const gridContainer = document.querySelector('[data-grid-container="true"]');
        if (!gridContainer) return;

        const position = CoordinateUtils.getGridPosition(e.clientX, e.clientY, gridContainer);
        if (!position) return;

        const [row, col] = position;
        const start = selectionStart.current;
        const isOutsideGrid = CoordinateUtils.isOutsideGrid(row, col, gridSize);

        // Preserve selection when cursor moves outside grid
        if (isOutsideGrid && lastDirection.current && selected.length > 0) {
            return;
        }

        const maxExtension = 3;
        if (row >= -maxExtension && row < gridSize + maxExtension &&
            col >= -maxExtension && col < gridSize + maxExtension) {

            if (lastDirection.current) {
                let targetRow = row;
                let targetCol = col;

                // Constrain movement to established direction
                if (lastDirection.current === 'horizontal') {
                    targetRow = start[0];
                } else if (lastDirection.current === 'vertical') {
                    targetCol = start[1];
                } else if (lastDirection.current === 'diagonal') {
                    const deltaR = targetRow - start[0];
                    const deltaC = targetCol - start[1];
                    const maxDelta = Math.max(Math.abs(deltaR), Math.abs(deltaC));
                    targetRow = start[0] + Math.sign(deltaR) * maxDelta;
                    targetCol = start[1] + Math.sign(deltaC) * maxDelta;
                }

                const verifyDirection = getDirection(start, [targetRow, targetCol]);
                if (verifyDirection === lastDirection.current) {
                    const selectionPath = GridSelection.generateSelectionPath(start, [targetRow, targetCol]);
                    const validSelection = GridSelection.filterValidCells(selectionPath, gridSize);
                    if (validSelection.length > 0) {
                        setSelected(validSelection);
                    }
                }
            } else {
                updateSelection(row, col);
            }
        }
    }, [gridSize, selected, updateSelection, isMouseDown, selectionStart, lastDirection, setSelected]);

    return {
        handleMouseDown,
        handleMouseEnter,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleGlobalMouseMove
    };
};
