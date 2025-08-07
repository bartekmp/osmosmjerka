import { useCallback } from 'react';
import { getCellFromTouch, getDirection } from './helpers';
import { GridSelection } from './gridUtils';

// Simplified coordinate calculation
const getGridPosition = (clientX, clientY, gridContainer) => {
    const rect = gridContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const gridRows = gridContainer.children.length;
    if (gridRows === 0) return null;

    const gridCols = gridContainer.children[0]?.children.length || 0;
    if (gridCols === 0) return null;

    const cellWidth = rect.width / gridCols;
    const cellHeight = rect.height / gridRows;

    const row = Math.floor(y / cellHeight);
    const col = Math.floor(x / cellWidth);

    return [row, col];
};

/**
 * Custom hook for mouse and touch movement handlers
 * Simplified and consolidated event handling
 */
export const useMovementHandlers = ({
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
}) => {

    // Unified selection update logic
    const updateCurrentSelection = useCallback((row, col) => {
        if (!selectionStart.current) return;

        const start = selectionStart.current;
        const newSelection = GridSelection.createConstrainedSelection(
            start,
            [row, col],
            gridSize,
            lastDirection.current
        );

        if (newSelection.length > 0) {
            setSelected(newSelection);
        }
    }, [gridSize, setSelected, selectionStart, lastDirection]);

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
        handlePhraseMatch();
    }, [endSelection, handlePhraseMatch, isMouseDown]);

    // Touch event handlers
    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        const cell = getCellFromTouch(e);
        if (cell) handleMouseDown(...cell);
    }, [handleMouseDown]);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        if (!isMouseDown.current || !selectionStart.current) return;

        const cell = getCellFromTouch(e);
        if (cell) handleMouseEnter(...cell);
    }, [handleMouseEnter, isMouseDown, selectionStart]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        handleMouseUp();
    }, [handleMouseUp]);

    // Simplified global mouse tracking
    const handleGlobalMouseMove = useCallback((e) => {
        if (!isMouseDown.current || !selectionStart.current) return;

        const gridContainer = document.querySelector('[data-grid-container="true"]');
        if (!gridContainer) return;

        const position = getGridPosition(e.clientX, e.clientY, gridContainer);
        if (!position) return;

        const [row, col] = position;
        const maxExtension = 3;

        // Allow extension outside grid boundaries
        if (row >= -maxExtension && row < gridSize + maxExtension &&
            col >= -maxExtension && col < gridSize + maxExtension) {

            if (lastDirection.current) {
                updateCurrentSelection(row, col);
            } else {
                updateSelection(row, col);
            }
        }
    }, [gridSize, updateSelection, updateCurrentSelection, isMouseDown, selectionStart, lastDirection]);

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
