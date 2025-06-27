import React, { useRef, useState } from 'react';
import './Grid.css';

export default function Grid({ grid, words, found, onFound }) {
    const [selected, setSelected] = useState([]);
    const isMouseDown = useRef(false);

    const isStraightLine = (path) => {
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

    const handleMouseDown = (r, c) => {
        isMouseDown.current = true;
        setSelected([[r, c]]);
        setDirection(null);
    };

    const getDirection = ([r0, c0], [r1, c1]) => {
        if (r0 === r1) return 'horizontal';
        if (c0 === c1) return 'vertical';
        if (Math.abs(r1 - r0) === Math.abs(c1 - c0)) return 'diagonal';
        return null;
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

    const isFound = (r, c) => {
        return words.some(w =>
            found.includes(w.word) &&
            w.coords.some(([wr, wc]) => wr === r && wc === c)
        );
    };

    if (grid.length === 0) return <div style={{ padding: '1rem' }}>No puzzle available</div>;

    return (
        <table
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setSelected([])}
            className="grid-table"
        >
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
