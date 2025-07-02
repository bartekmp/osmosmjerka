export default function PaginationControls({
    offset,
    limit,
    totalRows,
    offsetInput,
    handleOffsetInput,
    goToOffset,
    setOffset
}) {
    return (
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center' }}>
            <button
                className="scrabble-btn"
                onClick={() => setOffset(Math.max(offset - limit, 0))}
                disabled={offset === 0}
            >
                Previous
            </button>
            <span style={{ margin: '0 1rem' }}>Offset: {offset}</span>
            <button
                className="scrabble-btn"
                onClick={() => setOffset(Math.min(offset + limit, Math.max(totalRows - limit, 0)))}
                disabled={offset + limit >= totalRows}
            >
                Next
            </button>
            <span style={{ marginLeft: '2rem' }}>
                Go to offset:&nbsp;
                <input
                    type="number"
                    min="0"
                    max={Math.max(totalRows - limit, 0)}
                    value={offsetInput}
                    onChange={handleOffsetInput}
                    style={{ width: 60 }}
                />
                <button className="scrabble-btn" onClick={goToOffset} style={{ marginLeft: 6 }}>Go</button>
            </span>
        </div>
    );
}