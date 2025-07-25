import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
    Container, 
    Box, 
    Typography, 
    Button, 
    Grid, 
    FormControl, 
    InputLabel, 
    Select, 
    MenuItem,
    TextField,
    Paper,
    Stack
} from '@mui/material';
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
        clearDb,
        handleDelete
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

    // Handle inline save from table
    const handleInlineSave = (updatedRow) => {
        handleSave(updatedRow, () => fetchRows(offset, limit, filterCategory), () => {});
    };

    // Handle inline delete from table
    const handleInlineDelete = (id) => {
        handleDelete(id, () => fetchRows(offset, limit, filterCategory));
    };

    // Handle clear database with confirmation
    const handleClearDb = () => {
        if (window.confirm("Are you sure you want to delete ALL data? This action cannot be undone!")) {
            clearDb(() => fetchRows(offset, limit, filterCategory));
        }
    };

    // Logout handler
    const handleLogout = () => {
        setToken('');
        localStorage.removeItem('adminToken');
        setIsLogged(false);
    };

    if (!isLogged) {
        return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Box sx={{ textAlign: 'right', mb: 2 }}>
                    <Button component={Link} to="/" variant="outlined">
                        ← Back to Game
                    </Button>
                </Box>
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        Admin Login
                    </Typography>
                    <Box 
                        component="form" 
                        onSubmit={e => { e.preventDefault(); handleLogin(auth, setError); }}
                        sx={{ mt: 3 }}
                    >
                        <Stack spacing={3}>
                            <TextField
                                placeholder="Username"
                                value={auth.user}
                                onChange={e => setAuth({ ...auth, user: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <TextField
                                placeholder="Password"
                                type="password"
                                value={auth.pass}
                                onChange={e => setAuth({ ...auth, pass: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <Button type="submit" variant="contained" size="large">
                                Login
                            </Button>
                        </Stack>
                    </Box>
                    {error && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                            <Typography color="error.contrastText">{error}</Typography>
                        </Box>
                    )}
                    {isTokenExpired(token) && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                            <Typography color="warning.contrastText">
                                Session expired, please log in again.
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Container>
        );
    }

    if (dashboard && !editRow) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Button component={Link} to="/" variant="outlined">
                        ← Back to Game
                    </Button>
                    <Button onClick={handleLogout} variant="outlined" color="secondary">
                        Logout
                    </Button>
                </Box>
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        Admin Dashboard
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                        <Button 
                            onClick={() => fetchRows(offset, limit, filterCategory)} 
                            variant="contained"
                        >
                            Load Data
                        </Button>
                    </Box>
                    {error && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                            <Typography color="error.contrastText">{error}</Typography>
                        </Box>
                    )}
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button component={Link} to="/" variant="outlined">
                    ← Back to Game
                </Button>
                <Button onClick={handleLogout} variant="outlined" color="secondary">
                    Logout
                </Button>
            </Box>

            <Typography variant="h4" component="h2" gutterBottom align="center">
                Admin Panel
            </Typography>

            {/* Action Buttons */}
            <Paper sx={{ p: 3, mb: 3 }}>
                {/* Back to Dashboard - Separate on the left */}
                <Box sx={{ mb: 2 }}>
                    <Button 
                        onClick={() => setDashboard(true)}
                        variant="outlined"
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        <span style={{ marginRight: '8px' }}>🏠</span>
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            Back to Dashboard
                        </Box>
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                            Dashboard
                        </Box>
                    </Button>
                </Box>

                {/* Main Action Buttons */}
                <Grid container spacing={2} justifyContent="center">
                    <Grid item xs={6} sm={4} md={2}>
                        <Button 
                            fullWidth
                            onClick={() => fetchRows(offset, limit, filterCategory)}
                            variant="contained"
                            size="small"
                        >
                            <span style={{ marginRight: '4px' }}>📊</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Load Data
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Load
                            </Box>
                        </Button>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Button 
                            fullWidth
                            onClick={() => setEditRow({ categories: '', word: '', translation: '' })}
                            variant="contained"
                            color="secondary"
                            size="small"
                        >
                            <span style={{ marginRight: '4px' }}>➕</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Add Row
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Add
                            </Box>
                        </Button>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Box sx={{ height: '100%', display: 'flex' }}>
                            <UploadForm onUpload={() => fetchRows(offset, limit, filterCategory)} />
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Button 
                            fullWidth
                            onClick={() => handleExportTxt(filterCategory)}
                            variant="outlined"
                            color="success"
                            size="small"
                        >
                            <span style={{ marginRight: '4px' }}>💾</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Export
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Export
                            </Box>
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <Button 
                            fullWidth
                            onClick={handleClearDb}
                            variant="contained"
                            size="small"
                            sx={{ 
                                bgcolor: 'error.main',
                                color: 'white',
                                '&:hover': {
                                    bgcolor: 'error.dark',
                                }
                            }}
                        >
                            <span style={{ marginRight: '4px' }}>🗑️</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Clear All
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Clear
                            </Box>
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Edit Row Form */}
            <EditRowForm 
                editRow={editRow} 
                setEditRow={setEditRow} 
                handleSave={() => handleSave(editRow, () => fetchRows(offset, limit, filterCategory), setEditRow)} 
            />

            {/* Filter and Statistics */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <FormControl fullWidth sx={{ minWidth: 200 }}>
                            <InputLabel>Filter by category</InputLabel>
                            <Select 
                                value={filterCategory} 
                                label="Filter by category"
                                onChange={e => { setFilterCategory(e.target.value); setOffset(0); }}
                            >
                                <MenuItem value="">-- All Categories --</MenuItem>
                                {categories.map(cat => (
                                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="h6" align="center">
                            Total rows: {totalRows}
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Data Table */}
            <AdminTable 
                rows={rows} 
                setEditRow={setEditRow} 
                onSaveRow={handleInlineSave}
                onDeleteRow={handleInlineDelete}
            />

            {/* Pagination */}
            <Box sx={{ mt: 3 }}>
                <PaginationControls
                    offset={offset}
                    limit={limit}
                    totalRows={totalRows}
                    offsetInput={offsetInput}
                    handleOffsetInput={handleOffsetInput}
                    goToOffset={goToOffset}
                    setOffset={setOffset}
                />
            </Box>

            {/* Error Display */}
            {error && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                    <Typography color="error.contrastText">{error}</Typography>
                </Box>
            )}
        </Container>
    );
}