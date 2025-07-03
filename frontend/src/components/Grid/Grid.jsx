import React, { useEffect, useRef, useState } from 'react';
import './Grid.css';
import GridCell from './GridCell';
import { getCellFromTouch, getDirection, isStraightLine } from './helpers';

export default function Grid({ grid, words, found, onFound }) {
    const [selected, setSelected] = useState([]);
    const isMouseDown = useRef(false);

    // Handle mouse and touch events for selecting cells
    const handleMouseDown = (r, c) => {
        isMouseDown.current = true;
        setSelected([[r, c]]);
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

    const handleTouchStart = (e) => {
        const cell = getCellFromTouch(e);
        if (cell) {
            isMouseDown.current = true;
            setSelected([cell]);
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
                            return (
                                <GridCell
                                    key={c}
                                    r={r}
                                    c={c}
                                    cell={cell}
                                    isSelected={isSelected}
                                    isFound={isFound(r, c)}
                                    handleMouseDown={handleMouseDown}
                                    handleMouseEnter={handleMouseEnter}
                                />
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
