import { getDirection } from './helpers';

/**
 * Grid selection utilities - simplified and consolidated
 */
export class GridSelection {
    static generateSelectionPath(start, end) {
        const [startRow, startCol] = start;
        const [endRow, endCol] = end;

        const dr = Math.sign(endRow - startRow);
        const dc = Math.sign(endCol - startCol);
        const length = Math.max(Math.abs(endRow - startRow), Math.abs(endCol - startCol)) + 1;

        return Array.from({ length }, (_, i) => [
            startRow + dr * i,
            startCol + dc * i
        ]);
    }

    static filterValidCells(selection, gridSize) {
        return selection.filter(([r, c]) =>
            r >= 0 && r < gridSize && c >= 0 && c < gridSize
        );
    }

    static createSelectionString(selection) {
        return selection.map(([r, c]) => `${r},${c}`).join('');
    }

    // Simplified method that combines path generation, validation, and constraint application
    static createConstrainedSelection(start, target, gridSize, direction = null) {
        // Apply direction constraints if a direction is established
        if (direction) {
            target = this.applyDirectionConstraint(start, target, direction);
        }

        const selectionPath = this.generateSelectionPath(start, target);
        return this.filterValidCells(selectionPath, gridSize);
    }

    // Apply movement constraints based on established direction
    static applyDirectionConstraint(start, target, direction) {
        const [startRow, startCol] = start;
        let [targetRow, targetCol] = target;

        switch (direction) {
            case 'horizontal':
                return [startRow, targetCol];
            case 'vertical':
                return [targetRow, startCol];
            case 'diagonal':
                const deltaR = targetRow - startRow;
                const deltaC = targetCol - startCol;
                const maxDelta = Math.max(Math.abs(deltaR), Math.abs(deltaC));
                return [
                    startRow + Math.sign(deltaR) * maxDelta,
                    startCol + Math.sign(deltaC) * maxDelta
                ];
            default:
                return target;
        }
    }
}

/**
 * Simplified phrase matching
 */
export const findMatchingPhrase = (selectedCoords, phrases) => {
    const selectionString = GridSelection.createSelectionString(selectedCoords);
    return phrases.find(phrase =>
        GridSelection.createSelectionString(phrase.coords) === selectionString ||
        GridSelection.createSelectionString([...phrase.coords].reverse()) === selectionString
    );
};

/**
 * Simplified Mexican wave animation
 */
export const generateMexicanWave = (gridSize) => {
    const angle = Math.random() * 360;
    const angleRad = (angle * Math.PI) / 180;
    const centerX = gridSize / 2;
    const centerY = gridSize / 2;
    const maxDistance = Math.sqrt(Math.pow(gridSize, 2) + Math.pow(gridSize, 2));

    const cellsWithDistance = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const relativeX = c - centerX;
            const relativeY = r - centerY;
            const distance = relativeX * Math.cos(angleRad) + relativeY * Math.sin(angleRad);

            cellsWithDistance.push({
                row: r,
                col: c,
                distance: distance + maxDistance / 2
            });
        }
    }

    return cellsWithDistance.sort((a, b) => a.distance - b.distance);
};



/**
 * Touch and mouse coordinate utilities
 */
export class CoordinateUtils {
    static getGridPosition(clientX, clientY, gridContainer) {
        if (!gridContainer) return null;

        const rect = gridContainer.getBoundingClientRect();
        const cellSize = parseFloat(gridContainer.dataset.cellSize) || 40;
        const gap = 4;
        const padding = 4;

        const relativeX = clientX - rect.left - padding;
        const relativeY = clientY - rect.top - padding;

        const col = Math.floor(relativeX / (cellSize + gap));
        const row = Math.floor(relativeY / (cellSize + gap));

        return [row, col];
    }

    static isOutsideGrid(row, col, gridSize) {
        return row < 0 || row >= gridSize || col < 0 || col >= gridSize;
    }
}
