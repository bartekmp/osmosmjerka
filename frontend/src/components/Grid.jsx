import React, { useRef, useState } from 'react';

export default function Grid({ grid, words, onFound }) {
    const [selected, setSelected] = useState([]);
    const ref = useRef();

    const handleMouseDown = (r, c) => setSelected([[r, c]]);
    const handleMouseEnter = (r, c) => {
        if (selected.length > 0) setSelected([...selected, [r, c]]);
    };
    const handleMouseUp = () => {
        const wordStr = selected.map(([r, c]) => grid[r][c]).join("");
        const reversed = wordStr.split("").reverse().join("");
        for (const w of words) {
            const coordsStr = w.coords.map(([r, c]) => `${r},${c}`).join("");
            const selStr = selected.map(([r, c]) => `${r},${c}`).join("");
            if (selStr === coordsStr || selStr === coordsStr.split("").reverse().join("")) {
                onFound(w.word);
                break;
            }
        }
        setSelected([]);
    };

    const tableStyle = {
        borderSpacing: '10px',
        userSelect: 'none',
        fontFamily: 'monospace',
        fontSize: '1.2rem',
    };

    if (grid.length === 0) return <div style={{ padding: '1rem' }}>No puzzle available</div>;

    return (
        <table ref={ref} style={tableStyle} onMouseLeave={() => setSelected([])}>
            <tbody>
                {grid.map((row, r) => (
                    <tr key={r}>
                        {row.map((cell, c) => {
                            const isSelected = selected.some(([sr, sc]) => sr === r && sc === c);
                            return (
                                <td
                                    key={c}
                                    onMouseDown={() => handleMouseDown(r, c)}
                                    onMouseEnter={() => handleMouseEnter(r, c)}
                                    onMouseUp={handleMouseUp}
                                    style={{
                                        border: '1px solid black',
                                        padding: '5px',
                                        userSelect: 'none',
                                        background: isSelected ? '#faa' : 'white',
                                        textAlign: 'center'
                                    }}>
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