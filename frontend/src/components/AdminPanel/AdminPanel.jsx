import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UploadForm from '../UploadForm';
import './AdminPanel.css';
import AdminTable from './AdminTable';
import EditRowForm from './EditRowForm';
import { isTokenExpired } from './helpers';
import PaginationControls from './PaginationControls';
import { useAdminApi } from './useAdminApi';

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
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');

    const {
        fetchRows,
        handleLogin,
        handleSave,
        handleExportTxt,
        clearDb
    } = useAdminApi({
        token,
        setRows,
        setTotalRows,
        setDashboard,
        setError,
        setToken,
        setIsLogged
    });

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(data => setCategories(data));
    }, []);

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
    useEffect(() => {
        if (isLogged && !dashboard) fetchRows(offset, limit, filterCategory);
        // eslint-disable-next-line
    }, [offset, filterCategory]);

    // Check token on mount and after login
    useEffect(() => {
        if (token) {
            if (isTokenExpired(token)) {
                setIsLogged(false);
                setToken('');
                localStorage.removeItem('adminToken');
                return;
            }
            fetch('/admin/status', {
                headers: token
                    ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
                    : {}
            })
                .then(res => {
                    if (!res.ok) throw new Error("Unauthorized or server error");
                    setIsLogged(true);
                })
                .catch(() => {
                    setIsLogged(false);
                    setToken('');
                    localStorage.removeItem('adminToken');
                });
        }
        // eslint-disable-next-line
    }, [token]);

    // Logout handler
    const handleLogout = () => {
        setToken('');
        localStorage.removeItem('adminToken');
        setIsLogged(false);
    };

    if (!isLogged) {
        return (
            <div className="admin-panel-container">
                <div className="admin-panel-header">
                    <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                        ← Back to Game
                    </Link>
                </div>
                <h2>Admin Login</h2>
                <form onSubmit={e => { e.preventDefault(); handleLogin(auth, setError); }}>
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
                {isTokenExpired(token) && <div style={{ color: 'orange' }}>Session expired, please log in again.</div>}
            </div>
        );
    }

    if (dashboard && !editRow) {
        return (
            <div className="admin-panel-container">
                <div className="admin-panel-header">
                    <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                        ← Back to Game
                    </Link>
                </div>
                <h2>Admin Dashboard</h2>
                <button onClick={() => fetchRows(offset, limit, filterCategory)} style={{ marginLeft: '1rem' }}>Load Data</button>
                <button onClick={handleLogout} style={{ marginLeft: '1rem' }}>Logout</button>
                {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
            </div>
        );
    }

    return (
        <div className="admin-panel-container">
            <div className="admin-panel-header">
                <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>
                    ← Back to Game
                </Link>
                <button className="scrabble-btn" onClick={handleLogout} style={{ marginLeft: '2rem' }}>Logout</button>
            </div>
            <h2>Admin Panel</h2>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button className="scrabble-btn" onClick={() => setDashboard(true)}>Back to Dashboard</button>
                <button className="scrabble-btn" onClick={() => fetchRows(offset, limit, filterCategory)}>Load Data</button>
                <button className="scrabble-btn" onClick={() => setEditRow({ categories: '', word: '', translation: '' })}>Add Row</button>
                <UploadForm onUpload={() => fetchRows(offset, limit, filterCategory)} />
                <button className="scrabble-btn" onClick={() => handleExportTxt(filterCategory)} style={{ color: 'green' }}>Export to file</button>
                <button className="scrabble-btn" onClick={() => clearDb(() => fetchRows(offset, limit, filterCategory))} style={{ color: 'red' }}>Clear All</button>
            </div>

            <EditRowForm editRow={editRow} setEditRow={setEditRow} handleSave={() => handleSave(editRow, () => fetchRows(offset, limit, filterCategory), setEditRow)} />

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
            <AdminTable rows={rows} setEditRow={setEditRow} />
            <PaginationControls
                offset={offset}
                limit={limit}
                totalRows={totalRows}
                offsetInput={offsetInput}
                handleOffsetInput={handleOffsetInput}
                goToOffset={goToOffset}
                setOffset={setOffset}
            />
            {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
        </div>
    );
}