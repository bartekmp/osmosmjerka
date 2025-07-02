export default function EditRowForm({ editRow, setEditRow, handleSave }) {
    if (!editRow) return null;
    return (
        <div style={{
            marginBottom: '2rem',
            border: '1px solid gray',
            padding: '1rem',
            background: '#fff',
            boxShadow: '0 2px 12px #0001',
            zIndex: 10,
            minWidth: 320,
            maxWidth: 400
        }}>
            <h3>{editRow.id ? "Edit Row" : "Add Row"}</h3>
            <input
                placeholder="Categories"
                value={editRow.categories}
                onChange={e => setEditRow({ ...editRow, categories: e.target.value })}
            /><br />
            <input
                placeholder="Word"
                value={editRow.word}
                onChange={e => setEditRow({ ...editRow, word: e.target.value })}
            /><br />
            <input
                placeholder="Translation"
                value={editRow.translation}
                onChange={e => setEditRow({ ...editRow, translation: e.target.value })}
            /><br />
            <button className="scrabble-btn" onClick={handleSave}>Save</button>
            <button className="scrabble-btn" onClick={() => setEditRow(null)} style={{ marginLeft: '1rem' }}>Cancel</button>
        </div>
    );
}