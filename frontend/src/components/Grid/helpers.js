// Helper to check if a path is a straight line
export function isStraightLine(path) {
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
}

// Helper to determine direction
export function getDirection([r0, c0], [r1, c1]) {
    if (r0 === r1) return 'horizontal';
    if (c0 === c1) return 'vertical';
    if (Math.abs(r1 - r0) === Math.abs(c1 - c0)) return 'diagonal';
    return null;
}

// Helper to get cell from touch event
export function getCellFromTouch(e) {
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const cell = el.closest('td[data-row][data-col]');
    if (!cell) return null;
    return [parseInt(cell.dataset.row), parseInt(cell.dataset.col)];
}