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
    Stack,
    CircularProgress,
    Snackbar,
    Alert,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadForm from '../UploadForm';
import './AdminPanel.css';
import AdminTable from './AdminTable';
import EditRowForm from './EditRowForm';
import UserManagement from './UserManagement';
import UserProfile from './UserProfile';
import { isTokenExpired } from './helpers';
import PaginationControls from './PaginationControls';
import { useAdminApi } from './useAdminApi';
import { useThemeMode } from '../../contexts/ThemeContext';
import NightModeButton from '../NightModeButton';

export default function AdminPanel() {
    const [auth, setAuth] = useState({ user: '', pass: '' });
    const [rows, setRows] = useState([]);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(20);
    const [editRow, setEditRow] = useState(null);
    const [error, setError] = useState("");
    const [isLogged, setIsLogged] = useState(false);
    const [dashboard, setDashboard] = useState(true);
    const [userManagement, setUserManagement] = useState(false);
    const [userProfile, setUserProfile] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [categories, setCategories] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [totalRows, setTotalRows] = useState(0);
    const [offsetInput, setOffsetInput] = useState(0);
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
    const [clearLoading, setClearLoading] = useState(false);
    const [reloadLoading, setReloadLoading] = useState(false);
    const [clearNotification, setClearNotification] = useState({
        open: false,
        message: '',
        severity: 'success',
        autoHideDuration: 3000,
    });
    const { isDarkMode, toggleDarkMode } = useThemeMode();

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
                    return res.json();
                })
                .then(data => {
                    setIsLogged(true);
                    setCurrentUser(data.user);
                })
                .catch(() => {
                    setIsLogged(false);
                    setToken('');
                    localStorage.removeItem('adminToken');
                });
        }
        // eslint-disable-next-line
    }, [token]);

    // When switching to Browse Words, auto-load first page
    useEffect(() => {
        if (!dashboard && !userManagement && !userProfile) {
            setReloadLoading(true);
            fetchRows(0, limit, filterCategory);
            setOffset(0);
            setReloadLoading(false);
        }
        // eslint-disable-next-line
    }, [dashboard, userManagement, userProfile]);

    // Handle inline save from table
    const handleInlineSave = (updatedRow) => {
        handleSave(updatedRow, () => fetchRows(offset, limit, filterCategory), () => {});
    };

    // Handle inline delete from table
    const handleInlineDelete = (id) => {
        handleDelete(id, () => fetchRows(offset, limit, filterCategory));
    };

    // Handle clear database with confirmation and notification
    const handleClearDb = () => {
        if (window.confirm("Are you sure you want to delete ALL data? This action cannot be undone!")) {
            setClearLoading(true);
            setClearNotification((n) => ({ ...n, open: false }));
            const token = localStorage.getItem('adminToken');
            const headers = token ? { Authorization: 'Bearer ' + token } : {};
            fetch('/admin/clear', { method: 'DELETE', headers })
                .then(async res => {
                    const data = await res.json();
                    if (res.ok) {
                        setClearNotification({
                            open: true,
                            message: data.message || 'Database cleared',
                            severity: 'success',
                            autoHideDuration: 3000,
                        });
                        fetchRows(offset, limit, filterCategory);
                    } else {
                        setClearNotification({
                            open: true,
                            message: data.message || 'Failed to clear database',
                            severity: 'error',
                            autoHideDuration: null,
                        });
                    }
                })
                .catch(() => {
                    setClearNotification({
                        open: true,
                        message: 'Failed to clear database',
                        severity: 'error',
                        autoHideDuration: null,
                    });
                })
                .finally(() => setClearLoading(false));
        }
    };

    const handleClearClose = () => setClearNotification((n) => ({ ...n, open: false }));

    // Logout handler
    const handleLogout = () => {
        setToken('');
        localStorage.removeItem('adminToken');
        setIsLogged(false);
        setCurrentUser(null);
        setDashboard(true);
        setUserManagement(false);
        setUserProfile(false);
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
                        onSubmit={e => { e.preventDefault(); handleLogin(auth, setError, setCurrentUser); }}
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
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <NightModeButton />
                        <Button onClick={handleLogout} variant="outlined" color="secondary">
                            Logout
                        </Button>
                    </Box>
                </Box>
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        Admin Dashboard
                    </Typography>
                    <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                        Welcome, {currentUser?.username} ({currentUser?.role})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                        <Button 
                            onClick={() => setDashboard(false)} 
                            variant="contained"
                        >
                            Browse Words
                        </Button>
                        {currentUser?.role === 'root_admin' && (
                            <Button 
                                onClick={() => {
                                    setDashboard(false);
                                    setUserManagement(true);
                                }} 
                                variant="contained"
                                color="secondary"
                            >
                                User Management
                            </Button>
                        )}
                        <Button 
                            onClick={() => {
                                setDashboard(false);
                                setUserProfile(true);
                            }} 
                            variant="contained"
                            color="info"
                        >
                            Profile
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

    // User Management View
    if (userManagement) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                    <Button component={Link} to="/" variant="outlined">
                        ← Back to Game
                    </Button>
                    <Button 
                        onClick={() => {
                            setUserManagement(false);
                            setDashboard(true);
                        }} 
                        variant="outlined"
                    >
                        ← Dashboard
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <NightModeButton
                        sx={{ minWidth: 40, height: 40, fontSize: '1.5rem', p: 0, height: 40, mr: 1 }}
                    />
                    <Button onClick={handleLogout} variant="outlined" color="secondary" sx={{ height: 40 }}>
                        Logout
                    </Button>
                </Box>
                <Paper sx={{ p: 3 }}>
                    <UserManagement currentUser={currentUser} />
                </Paper>
            </Container>
        );
    }

    // User Profile View
    if (userProfile) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Button component={Link} to="/" variant="outlined">
                        ← Back to Game
                    </Button>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button 
                            onClick={() => {
                                setUserProfile(false);
                                setDashboard(true);
                            }} 
                            variant="outlined"
                        >
                            ← Dashboard
                        </Button>
                        <Button onClick={handleLogout} variant="outlined" color="secondary">
                            Logout
                        </Button>
                    </Box>
                </Box>
                
                <Paper sx={{ p: 3 }}>
                    <UserProfile currentUser={currentUser} />
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                <Button component={Link} to="/" variant="outlined">
                    ← Back to Game
                </Button>
                <Button 
                    onClick={() => setDashboard(true)}
                    variant="outlined"
                >
                    ← Dashboard
                </Button>
                <Box sx={{ flex: 1 }} />
                <NightModeButton
                    sx={{ minWidth: 40, height: 40, fontSize: '1.5rem', p: 0, mr: 1 }}
                />
                <Button onClick={handleLogout} variant="outlined" color="secondary" sx={{ height: 40 }}>
                    Logout
                </Button>
            </Box>

            <Typography variant="h4" component="h2" gutterBottom align="center">
                Admin Panel
            </Typography>

            {/* Action Buttons */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={2} justifyContent="center">
                    <Grid item xs={6} sm={4} md={2}>
                        <Button 
                            fullWidth
                            onClick={() => {
                                setReloadLoading(true);
                                fetchRows(offset, limit, filterCategory);
                                setTimeout(() => setReloadLoading(false), 500); // ensure spinner is visible
                            }}
                            variant="contained"
                            size="small"
                            disabled={reloadLoading}
                            startIcon={reloadLoading ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            <span style={{ marginRight: '4px' }}>📊</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Reload Data
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Reload
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
                                Download Words
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Download
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
                            disabled={clearLoading}
                            startIcon={clearLoading ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            <span style={{ marginRight: '4px' }}>🗑️</span>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                Clear Database
                            </Box>
                            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                                Clear
                            </Box>
                        </Button>
                        <Snackbar
                            open={clearNotification.open}
                            autoHideDuration={clearNotification.severity === 'success' ? clearNotification.autoHideDuration : null}
                            onClose={handleClearClose}
                            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                        >
                            <Alert
                                severity={clearNotification.severity}
                                action={
                                    <IconButton size="small" color="inherit" onClick={handleClearClose}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                }
                                onClose={handleClearClose}
                            >
                                {clearNotification.message}
                            </Alert>
                        </Snackbar>
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