import React, { useEffect, useRef, useState } from 'react';
import './Grid.css';

export default function Grid({ grid, words, found, onFound }) {
    const [selected, setSelected] = useState([]);
    const isMouseDown = useRef(false);

    const isStraightLine = (path) => {
        // Check if the path is a straight line (horizontal, vertical, or diagonal)
        // A path is a straight line if it consists of points that are either all in the same row, column, or diagonal.
        // It makes no sense for the player to select anything that is not a straight line

        if (path.length < 2) return false;
        const [r0, c0] = path[0];
        const [r1, c1] = path[path.length - 1];
        const dr = r1 - r0;
        const dc = c1 - c0;

        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;

        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        for (let i = 0; i <= steps; i++) {
            const rr = r0 + Math.sign(dr) * i;
            const cc = c0 + Math.sign(dc) * i;
            if (!path.some(([r, c]) => r === rr && c === cc)) return false;
        }
        return true;
    };

    const [direction, setDirection] = useState(null); // 'horizontal' | 'vertical' | 'diagonal'

    // Function to determine the direction of the selection based on start and end coordinates
    const getDirection = ([r0, c0], [r1, c1]) => {
        if (r0 === r1) return 'horizontal';
        if (c0 === c1) return 'vertical';
        if (Math.abs(r1 - r0) === Math.abs(c1 - c0)) return 'diagonal';
        return null;
    };

    // Handle mouse and touch events for selecting cells
    const handleMouseDown = (r, c) => {
        isMouseDown.current = true;
        setSelected([[r, c]]);
        setDirection(null);
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

        setDirection(newDirection);
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

    // Function to get cell coordinates from touch events
    // This function retrieves the cell coordinates from a touch event by checking the touch position
    // and finding the closest table cell that has data attributes for row and column.
    const getCellFromTouch = (e) => {
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!el) return null;
        const cell = el.closest('td[data-row][data-col]');
        if (!cell) return null;
        return [parseInt(cell.dataset.row), parseInt(cell.dataset.col)];
    };

    const handleTouchStart = (e) => {
        const cell = getCellFromTouch(e);
        if (cell) {
            isMouseDown.current = true;
            setSelected([cell]);
            setDirection(null);
        }
    };

    const handleTouchMove = (e) => {
        if (!isMouseDown.current) return;
        const cell = getCellFromTouch(e);
        if (cell) {
            handleMouseEnter(...cell);
        }
    };

    const handleTouchEnd = () => {
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

    if (grid.length === 0) return <div style={{ padding: '1rem' }}>No puzzle available</div>;

    return (
        <table
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setSelected([])}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="grid-table"
            style={{ touchAction: 'none' }}
        >
            <colgroup>
                {grid[0].map((_, idx) => (
                    <col
                        key={idx}
                        style={{
                            width: window.innerWidth <= 600 ? '2.2em' : '4em'
                        }}
                    />
                ))}
            </colgroup>
            <tbody>
                {grid.map((row, r) => (
                    <tr key={r}>
                        {row.map((cell, c) => {
                            const isSelected = selected.some(([sr, sc]) => sr === r && sc === c);
                            const cellClasses = [
                                "grid-cell",
                                isSelected ? "selected" : "",
                                isFound(r, c) ? "found" : ""
                            ].join(" ").trim();

                            return (
                                <td
                                    key={c}
                                    data-row={r}
                                    data-col={c}
                                    onMouseDown={() => handleMouseDown(r, c)}
                                    onMouseEnter={() => handleMouseEnter(r, c)}
                                    className={cellClasses}
                                >
                                    {cell}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
