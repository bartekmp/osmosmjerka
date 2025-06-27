import { useState } from 'react';

export default function AdminPanel() {
    const [auth, setAuth] = useState({ user: '', pass: '' });
    const [rows, setRows] = useState([]);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [editRow, setEditRow] = useState(null);
    const [error, setError] = useState("");
    const [isLogged, setIsLogged] = useState(false);
    const [dashboard, setDashboard] = useState(true);

    const authHeader = {
        Authorization: 'Basic ' + btoa(`${auth.user}:${auth.pass}`),
        'Content-Type': 'application/json',
    };

    const fetchRows = () => {
        fetch(`/admin/rows?offset=${offset}&limit=${limit}`, { headers: authHeader })
            .then(res => {
                if (!res.ok) throw new Error("Unauthorized or server error");
                return res.json();
            })
            .then(data => {
                setRows(data);
                setDashboard(false);
                setError("");
            })
            .catch(err => {
                setError(err.message);
            });
    };

    const handleLogin = () => {
        fetch(`/admin/status`, { headers: authHeader })
            .then(res => {
                if (!res.ok) throw new Error("Unauthorized or server error");
                setIsLogged(true);
                setError("");
            })
            .catch(err => {
                setError(err.message);
                setIsLogged(false);
            });
    };

    const handleSave = () => {
        const method = editRow.id ? 'PUT' : 'POST';
        const url = editRow.id ? `/admin/row/${editRow.id}` : `/admin/row`;
        fetch(url, {
            method,
            headers: authHeader,
            body: JSON.stringify(editRow)
        }).then(() => {
            fetchRows();
            if (editRow.id) {
                setEditRow(null);
            } else {
                setEditRow({ categories: '', word: '', translation: '' });
            }
        });
    };

    const clearDb = () => {
        if (!window.confirm("Are you sure you want to delete all data?")) return;
        fetch("/admin/clear", { method: "DELETE", headers: authHeader })
            .then(() => fetchRows());
    };

    if (!isLogged) {
        return (
            <div>
                <h2>Admin Login</h2>
                <form onSubmit={e => { e.preventDefault(); handleLogin(); }}>
                    <input
                        placeholder="Username"
                        value={auth.user}
                        onChange={e => setAuth({ ...auth, user: e.target.value })}
                    /><br />
                    <input
                        placeholder="Password"
                        type="password"
                        value={auth.pass}
                        onChange={e => setAuth({ ...auth, pass: e.target.value })}
                    /><br />
                    <button type="submit">Login</button>
                </form>
                {error && <div style={{ color: 'red' }}>{error}</div>}
            </div>
        );
    }

    if (dashboard && !editRow) {
        return (
            <div>
                <h2>Admin Dashboard</h2>
                <button onClick={fetchRows}>Load Data</button>
                <button onClick={() => setEditRow({ categories: '', word: '', translation: '' })} style={{ marginLeft: '1rem' }}>Add Row</button>
                <button onClick={clearDb} style={{ marginLeft: '1rem', color: 'red' }}>Clear All</button>
                {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
            </div>
        );
    }

    return (
        <div>
            <h2>Admin Panel</h2>
            <button onClick={() => setDashboard(true)}>Back to Dashboard</button>
            <button onClick={fetchRows} style={{ marginLeft: '1rem' }}>Load Data</button>
            <button onClick={() => setEditRow({ categories: '', word: '', translation: '' })} style={{ marginLeft: '1rem' }}>Add Row</button>
            <button onClick={clearDb} style={{ marginLeft: '1rem', color: 'red' }}>Clear All</button>
            <table style={{ marginTop: '1rem', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th>ID</th><th>Categories</th><th>Word</th><th>Translation</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.id}>
                            <td>{row.id}</td>
                            <td>{row.categories}</td>
                            <td>{row.word}</td>
                            <td>{row.translation}</td>
                            <td><button onClick={() => setEditRow(row)}>Edit</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ marginTop: '1rem' }}>
                <button onClick={() => { setOffset(Math.max(offset - limit, 0)); fetchRows(); }}>Previous</button>
                <span style={{ margin: '0 1rem' }}>Offset: {offset}</span>
                <button onClick={() => { setOffset(offset + limit); fetchRows(); }}>Next</button>
            </div>

            {editRow && (
                <div style={{ marginTop: '2rem', border: '1px solid gray', padding: '1rem' }}>
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
                    <button onClick={handleSave}>Save</button>
                    <button onClick={() => setEditRow(null)} style={{ marginLeft: '1rem' }}>Cancel</button>
                </div>
            )}
            {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
        </div>
    );
}
