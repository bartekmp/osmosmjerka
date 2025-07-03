import React from 'react';

export default function GridCell({ r, c, cell, isSelected, isFound, handleMouseDown, handleMouseEnter }) {
    const cellClasses = [
        "grid-cell",
        isSelected ? "selected" : "",
        isFound ? "found" : ""
    ].join(" ").trim();

    return (
        <td
            data-row={r}
            data-col={c}
            onMouseDown={() => handleMouseDown(r, c)}
            onMouseEnter={() => handleMouseEnter(r, c)}
            className={cellClasses}
        >
            {cell}
        </td>
    );
}