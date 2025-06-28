import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UploadForm from './UploadForm';

export default function AdminPanel() {
    const [auth, setAuth] = useState({ user: '', pass: '' });
    const [rows, setRows] = useState([]);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [editRow, setEditRow] = useState(null);
    const [error, setError] = useState("");
    const [isLogged, setIsLogged] = useState(false);
    const [dashboard, setDashboard] = useState(true);
    const [categories, setCategories] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [totalRows, setTotalRows] = useState(0);
    const [offsetInput, setOffsetInput] = useState(0);

    const authHeader = {
        Authorization: 'Basic ' + btoa(`${auth.user}:${auth.pass}`),
        'Content-Type': 'application/json',
    };

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(data => setCategories(data));
    }, []);

    const fetchRows = () => {
        let url = `/admin/rows?offset=${offset}&limit=${limit}`;
        if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`;
        fetch(url, { headers: authHeader })
            .then(res => {
                if (!res.ok) throw new Error("Unauthorized or server error");
                return res.json();
            })
            .then(data => {
                setRows(data.rows || data); // Handle both paginated and non-paginated responses
                setTotalRows(data.total || data.length || 0);
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

    const handleExportTxt = () => {
        const params = new URLSearchParams();
        if (filterCategory) params.append('category', filterCategory);

        axios.get(`/admin/export?${params.toString()}`, {
            headers: authHeader,
            responseType: 'blob'
        }).then(res => {
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `export_${filterCategory || 'all'}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        });
    };

    const clearDb = () => {
        if (!window.confirm("Are you sure you want to delete all data?")) return;
        fetch("/admin/clear", { method: "DELETE", headers: authHeader })
            .then(() => fetchRows());
    };

    // Handlers for pagination and offset input, to avoid negative or excessive values
    const handleOffsetInput = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        if (val > Math.max(totalRows - limit, 0)) val = Math.max(totalRows - limit, 0);
        setOffsetInput(val);
    };
    const goToOffset = () => {
        const val = parseInt(offsetInput, 10);
        if (!isNaN(val) && val >= 0 && val <= Math.max(totalRows - limit, 0)) {
            setOffset(val);
        }
    };

    // Automatically fetch rows when logged in and dashboard is active
    // This ensures that the data is loaded when the user logs in or when the filter changes
    // and the dashboard is not showing editRow.
    useEffect(() => {
        if (isLogged && !dashboard) fetchRows();
        // eslint-disable-next-line
    }, [offset, filterCategory]);

    if (!isLogged) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ alignSelf: 'flex-end', marginBottom: '1rem' }}>
                    <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                        ← Back to Game
                    </Link>
                </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ alignSelf: 'flex-end', marginBottom: '1rem' }}>
                    <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                        ← Back to Game
                    </Link>
                </div>
                <h2>Admin Dashboard</h2>
                <button onClick={fetchRows} style={{ marginLeft: '1rem' }}>Load Data</button>
                <button onClick={() => setEditRow({ categories: '', word: '', translation: '' })} style={{ marginLeft: '1rem' }}>Add Row</button>
                <button onClick={clearDb} style={{ marginLeft: '1rem', color: 'red' }}>Clear All</button>
                {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ alignSelf: 'flex-end', marginBottom: '1rem' }}>
                <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                    ← Back to Game
                </Link>
            </div>
            <h2>Admin Panel</h2>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button className="scrabble-btn" onClick={() => setDashboard(true)}>Back to Dashboard</button>
                <button className="scrabble-btn" onClick={fetchRows}>Load Data</button>
                <button className="scrabble-btn" onClick={() => setEditRow({ categories: '', word: '', translation: '' })}>Add Row</button>
                <UploadForm onUpload={fetchRows} />
                <button className="scrabble-btn" onClick={handleExportTxt} style={{ color: 'green' }}>Export to file</button>
                <button className="scrabble-btn" onClick={clearDb} style={{ color: 'red' }}>Clear All</button>
            </div>

            {editRow && (
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
            )}

            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <label>
                    Filter by category:&nbsp;
                    <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setOffset(0); }} className="scrabble-select">
                        <option value="">-- All --</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <b>Total rows: {totalRows}</b>
            </div>
            <table
                style={{
                    marginTop: '1rem',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    background: '#fff'
                }}
            >
                <thead>
                    <tr>
                        <th style={{ padding: '6px 12px 6px 0' }}>ID</th>
                        <th style={{ padding: '6px 12px 6px 0' }}>Categories</th>
                        <th style={{ padding: '6px 12px 6px 0' }}>Word</th>
                        <th style={{ padding: '6px 12px 6px 0' }}>Translation</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.id}>
                            <td style={{
                                borderRight: '2px solid #e0e0e0',
                                padding: '6px 12px 6px 0'
                            }}>{row.id}</td>
                            <td style={{
                                borderRight: '2px solid #e0e0e0',
                                padding: '6px 12px 6px 0'
                            }}>{row.categories}</td>
                            <td style={{
                                borderRight: '2px solid #e0e0e0',
                                padding: '6px 12px 6px 0'
                            }}>{row.word}</td>
                            <td style={{
                                borderRight: '2px solid #e0e0e0',
                                padding: '6px 12px 6px 0'
                            }}>{row.translation}</td>
                            <td style={{ padding: '6px 0 6px 12px' }}>
                                <button className="scrabble-btn" onClick={() => setEditRow(row)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

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

            {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
        </div>
    );
}
