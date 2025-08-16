import { useThemeMode } from '@contexts/ThemeContext';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Container,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { AdminButton, AdminLayout, API_ENDPOINTS, ResponsiveActionButton, STORAGE_KEYS } from '@shared';
import { RateLimitWarning } from '@shared/components/ui/RateLimitWarning';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminTable from './AdminTable';
import BatchOperationDialog from './BatchOperationDialog';
import BatchOperationsToolbar from './BatchOperationsToolbar';
import BatchResultDialog from './BatchResultDialog';
import EditRowForm from './EditRowForm';
import { isTokenExpired } from './helpers';
import LanguageSetManagement from './LanguageSetManagement';
import DuplicateManagement from './DuplicateManagement';
import PageSizeSelector from './PageSizeSelector';
import PaginationControls from './PaginationControls';
import { useAdminApi } from './useAdminApi';
import UploadForm from '../UploadForm';
import UserManagement from './UserManagement';
import UserProfile from './UserProfile';
import StatisticsDashboard from '../StatisticsDashboard/StatisticsDashboard';
import './AdminPanel.css';

export default function AdminPanel({ 
    ignoredCategories = [], 
    userIgnoredCategories = [], 
    onUpdateUserIgnoredCategories = () => {} 
}) {
    const { t } = useTranslation();
    const [auth, setAuth] = useState({ user: '', pass: '' });
    const [rows, setRows] = useState([]);
    const [offset, setOffset] = useState(0);
    const [limit, setLimit] = useState(() => {
        // Load page size from localStorage or default to 20
        const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PAGE_SIZE);
        return saved ? parseInt(saved) : 20;
    });
    const [editRow, setEditRow] = useState(null);
    const [error, setError] = useState("");
    const [isLogged, setIsLogged] = useState(false);
    const [dashboard, setDashboard] = useState(true);
    const [userManagement, setUserManagement] = useState(false);
    const [userProfile, setUserProfile] = useState(false);
    const [statisticsDashboard, setStatisticsDashboard] = useState(false);
    const [languageSetManagement, setLanguageSetManagement] = useState(false);
    const [duplicateManagement, setDuplicateManagement] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [categories, setCategories] = useState([]);
    const [languageSets, setLanguageSets] = useState([]);
    const [languageSetsLoading, setLanguageSetsLoading] = useState(true);
    const [showIgnoredCategories, setShowIgnoredCategories] = useState(false);
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedLanguageSetId, setSelectedLanguageSetId] = useState(() => {
        // Load from localStorage or default to null (will be set when language sets load)
        const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
        return saved ? parseInt(saved) : null;
    });
    const [totalRows, setTotalRows] = useState(0);
    const [offsetInput, setOffsetInput] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const [languageSetsLoaded, setLanguageSetsLoaded] = useState(false);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);

    // Batch operations state
    const [batchMode, setBatchMode] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [batchDialog, setBatchDialog] = useState({ open: false, operation: null });
    const [batchResult, setBatchResult] = useState({ open: false, operation: null, result: null });
    const [batchLoading, setBatchLoading] = useState(false);

    // Memoize search term handler to prevent unnecessary re-renders
    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value);
        setOffset(0); // Reset to first page when searching
    }, []);
    const [token, setToken] = useState(localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || '');
    const [clearLoading, setClearLoading] = useState(false);
    const [reloadLoading, setReloadLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [clearNotification, setClearNotification] = useState({
        open: false,
        message: '',
        severity: 'success',
        autoHideDuration: 3000,
    });
    const { isDarkMode, toggleDarkMode } = useThemeMode();

    const {
        fetchRows: originalFetchRows,
        handleLogin,
        handleSave,
        handleExportTxt,
        clearDb,
        handleDelete,
        handleBatchDelete,
        handleBatchAddCategory,
        handleBatchRemoveCategory,
        isFetchingRows,
        showFetchRateLimit
    } = useAdminApi({
        token,
        setRows,
        setTotalRows,
        setDashboard,
        setError,
        setToken,
        setIsLogged
    });

    // Wrap fetchRows to handle loading state
    const fetchRows = useCallback((...args) => {
        setDataLoading(true);
        // Call original fetchRows and set up a listener for when data changes
        originalFetchRows(...args);
    }, [originalFetchRows]);

    // Clear loading state when rows change (indicating fetch completed)
    useEffect(() => {
        if (dataLoading) {
            const timer = setTimeout(() => setDataLoading(false), 100);
            return () => clearTimeout(timer);
        }
    }, [rows, dataLoading]);

    useEffect(() => {
        // Only make admin API calls if user is properly logged in
        if (!isLogged || !token) {
            // Clear admin data when not logged in
            setCategories([]);
            setLanguageSets([]);
            setRows([]);
            setTotalRows(0);
            setLanguageSetsLoading(true);
            setLanguageSetsLoaded(false);
            setCategoriesLoaded(false);
            return;
        }

        // Always load language sets when user logs in (needed for dashboard button logic)
        if (!languageSetsLoaded && currentUser) {
            // Use different endpoints based on user role
            const endpoint = currentUser?.role === 'admin' || currentUser?.role === 'root_admin' 
                ? API_ENDPOINTS.ADMIN_LANGUAGE_SETS 
                : API_ENDPOINTS.LANGUAGE_SETS;
                
            console.log('Loading language sets for user:', currentUser, 'using endpoint:', endpoint);
                
            fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => res.json())
                .then(data => {
                    setLanguageSets(data);
                    setLanguageSetsLoading(false);
                    setLanguageSetsLoaded(true);
                    // Auto-select first language set if none is selected
                    if (data.length > 0 && !selectedLanguageSetId) {
                        const firstSetId = data[0].id;
                        setSelectedLanguageSetId(firstSetId);
                        localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, firstSetId.toString());
                    }
                    // If no language sets exist, show error
                    if (data.length === 0) {
                        setError(t('no_language_sets_error'));
                    }
                })
                .catch(err => {
                    console.error('Failed to load language sets:', err);
                    setLanguageSetsLoading(false);
                });
        }
    }, [isLogged, token, languageSetsLoaded, currentUser]);

    // Separate useEffect for categories that depends on selectedLanguageSetId
    useEffect(() => {
        // Reset categories loaded flag when language set changes
        setCategoriesLoaded(false);
    }, [selectedLanguageSetId]);

    useEffect(() => {
        // Only load categories when navigating to views that need them and language set is selected
        const needsCategories = (!dashboard && !userManagement && !userProfile && !statisticsDashboard && !duplicateManagement) || languageSetManagement;
        if (isLogged && token && selectedLanguageSetId && needsCategories && !categoriesLoaded) {
            fetch(`${API_ENDPOINTS.ALL_CATEGORIES}?language_set_id=${selectedLanguageSetId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => res.json())
                .then(data => {
                    setCategories(data);
                    setCategoriesLoaded(true);
                })
                .catch(err => console.error('Failed to load categories:', err));
        }
    }, [isLogged, token, selectedLanguageSetId, dashboard, userManagement, userProfile, statisticsDashboard, languageSetManagement, duplicateManagement, categoriesLoaded]);

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

    // Page size handler
    const handlePageSizeChange = (newLimit) => {
        setLimit(newLimit);
        setOffset(0); // Reset to first page when changing page size
        localStorage.setItem(STORAGE_KEYS.ADMIN_PAGE_SIZE, newLimit.toString());
    };

    // Batch mode handlers
    const handleEnterBatchMode = () => {
        setBatchMode(true);
        setSelectedRows([]);
    };

    const handleExitBatchMode = () => {
        setBatchMode(false);
        setSelectedRows([]);
    };

    const handleBatchModeToggle = () => {
        if (batchMode) {
            handleExitBatchMode();
        } else {
            handleEnterBatchMode();
        }
    };

    const handleRowSelectionChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    // Batch operation handlers
    const handleBatchDeleteClick = () => {
        setBatchDialog({ open: true, operation: 'delete' });
    };

    const handleBatchAddCategoryClick = () => {
        setBatchDialog({ open: true, operation: 'add_category' });
    };

    const handleBatchRemoveCategoryClick = () => {
        setBatchDialog({ open: true, operation: 'remove_category' });
    };

    const handleBatchConfirm = async (categoryName = '') => {
        setBatchLoading(true);
        setBatchDialog({ open: false, operation: null });

        let result;
        const operation = batchDialog.operation;

        try {
            switch (operation) {
                case 'delete':
                    result = await handleBatchDelete(selectedRows, selectedLanguageSetId);
                    break;
                case 'add_category':
                    result = await handleBatchAddCategory(selectedRows, categoryName, selectedLanguageSetId);
                    break;
                case 'remove_category':
                    result = await handleBatchRemoveCategory(selectedRows, categoryName, selectedLanguageSetId);
                    break;
                default:
                    throw new Error('Unknown batch operation');
            }

            // Show result dialog
            setBatchResult({ open: true, operation, result });

            // If successful, refresh data and clear selections
            if (result.success) {
                setSelectedRows([]);
                if (selectedLanguageSetId) {
                    fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                }
            }
        } catch (error) {
            setBatchResult({
                open: true,
                operation,
                result: { success: false, error: error.message }
            });
        } finally {
            setBatchLoading(false);
        }
    };

    const handleBatchDialogClose = () => {
        setBatchDialog({ open: false, operation: null });
    };

    const handleBatchResultClose = () => {
        setBatchResult({ open: false, operation: null, result: null });
    };

    // Automatically fetch rows when logged in and dashboard is active
    useEffect(() => {
        if (isLogged && !dashboard && selectedLanguageSetId) {
            fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
        }
        // eslint-disable-next-line
    }, [offset, filterCategory, selectedLanguageSetId, limit]);

    // Clear selections when exiting batch mode
    useEffect(() => {
        if (!batchMode) {
            setSelectedRows([]);
        }
    }, [batchMode]);

    // Fetch rows when search term changes
    useEffect(() => {
        if (isLogged && !dashboard && searchTerm !== undefined && selectedLanguageSetId) {
            fetchRows(0, limit, filterCategory, searchTerm, selectedLanguageSetId);
            setOffset(0); // Reset to first page when searching
        }
        // eslint-disable-next-line
    }, [searchTerm, filterCategory, selectedLanguageSetId, limit]);

    // Check token on mount and after login
    useEffect(() => {
        if (token) {
            if (isTokenExpired(token)) {
                setIsLogged(false);
                setToken('');
                localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
                return;
            }
            fetch(API_ENDPOINTS.USER_PROFILE, {
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
                    setCurrentUser(data); // Profile endpoint returns user data directly
                })
                .catch(() => {
                    setIsLogged(false);
                    setToken('');
                    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
                });
        }
        // eslint-disable-next-line
    }, [token]);

    // When switching to Browse Phrases, auto-load first page
    useEffect(() => {
        if (isLogged && !dashboard && !userManagement && !userProfile && !statisticsDashboard && !languageSetManagement && selectedLanguageSetId) {
            setReloadLoading(true);
            fetchRows(0, limit, filterCategory, searchTerm, selectedLanguageSetId);
            setOffset(0);
            setReloadLoading(false);
        }
        // eslint-disable-next-line
    }, [isLogged, dashboard, userManagement, userProfile, statisticsDashboard, languageSetManagement, selectedLanguageSetId]);

    // Handle inline save from table with optimistic updates
    const handleInlineSave = useCallback((updatedRow) => {
        // Optimistically update the local state first
        setRows(prevRows =>
            prevRows.map(row =>
                row.id === updatedRow.id ? { ...row, ...updatedRow } : row
            )
        );

        // Then save to server
        // If it's a new row, use POST; otherwise, use PUT to update
        const method = updatedRow.id ? 'PUT' : 'POST';
        const url = updatedRow.id ? `/admin/row/${updatedRow.id}` : `/admin/row`;
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        const headers = token
            ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json' };

        fetch(url, {
            method,
            headers,
            body: JSON.stringify(updatedRow)
        }).catch(err => {
            // If save fails, revert the optimistic update
            console.error('Save failed:', err);
            if (selectedLanguageSetId) {
                fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
            }
        });
    }, [offset, limit, filterCategory, selectedLanguageSetId, fetchRows]);

    // Handle inline delete from table with optimistic updates
    const handleInlineDelete = useCallback((id) => {
        if (window.confirm(t('confirm_delete_phrase'))) {
            // Optimistically remove from local state first
            setRows(prevRows => prevRows.filter(row => row.id !== id));
            setTotalRows(prev => prev - 1);

            // Then delete from server
            const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
            const headers = token
                ? { Authorization: 'Bearer ' + token }
                : {};

            fetch(`/admin/row/${id}`, {
                method: 'DELETE',
                headers
            }).catch(err => {
                // If delete fails, reload the data
                console.error('Delete failed:', err);
                if (selectedLanguageSetId) {
                    fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                }
            });
        }
    }, [offset, limit, filterCategory, selectedLanguageSetId, fetchRows, t]);

    // Handle clear database with confirmation and notification
    const handleClearDb = () => {
        if (window.confirm(t('confirm_clear_db'))) {
            setClearLoading(true);
            setClearNotification((n) => ({ ...n, open: false }));
            const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
            const headers = token ? { Authorization: 'Bearer ' + token } : {};
            fetch(API_ENDPOINTS.ADMIN_CLEAR, { method: 'DELETE', headers })
                .then(async res => {
                    const data = await res.json();
                    if (res.ok) {
                        setClearNotification({
                            open: true,
                            message: data.message || t('db_cleared'),
                            severity: 'success',
                            autoHideDuration: 3000,
                        });
                        if (selectedLanguageSetId) {
                            fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                        }
                    } else {
                        setClearNotification({
                            open: true,
                            message: data.message || t('clear_db_failed'),
                            severity: 'error',
                            autoHideDuration: null,
                        });
                    }
                })
                .catch(() => {
                    setClearNotification({
                        open: true,
                        message: t('clear_db_failed'),
                        severity: 'error',
                        autoHideDuration: null,
                    });
                })
                .finally(() => setClearLoading(false));
        }
    };

    const handleClearClose = () => setClearNotification((n) => ({ ...n, open: false }));

    // Function to toggle ignored categories for logged in users
    const toggleIgnoredCategory = async (category) => {
        if (!currentUser || !selectedLanguageSetId) return;

        try {
            const isCurrentlyIgnored = userIgnoredCategories.includes(category);
            const newIgnoredCategories = isCurrentlyIgnored
                ? userIgnoredCategories.filter(c => c !== category)
                : [...userIgnoredCategories, category];

            // Update backend
            const response = await fetch('/api/user/ignored-categories', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    language_set_id: selectedLanguageSetId,
                    categories: newIgnoredCategories
                })
            });

            if (response.ok) {
                onUpdateUserIgnoredCategories(newIgnoredCategories);
                // Refresh the data to reflect the changes
                if (selectedLanguageSetId) {
                    fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                }
            } else {
                const data = await response.json();
                setError(data.error || t('ignored_categories_updated_error'));
            }
        } catch (err) {
            console.error('Failed to update ignored categories:', err);
            setError(t('ignored_categories_updated_error'));
        }
    };

    // Logout handler
    const handleLogout = () => {
        setToken('');
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        setIsLogged(false);
        setCurrentUser(null);
        setDashboard(true);
        setUserManagement(false);
        setLanguageSetManagement(false);
        setDuplicateManagement(false);
        setUserProfile(false);
        setStatisticsDashboard(false);
    };

    if (!isLogged) {
        return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Box sx={{ textAlign: 'right', mb: 2 }}>
                    <AdminButton
                        to="/"
                        desktopText={`⇇ ${t('back_to_game')}`}
                        mobileText="🏠"
                    />
                </Box>
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        {t('admin_login')}
                    </Typography>
                    <Box
                        component="form"
                        onSubmit={e => { e.preventDefault(); handleLogin(auth, setError, setCurrentUser); }}
                        sx={{ mt: 3 }}
                    >
                        <Stack spacing={3}>
                            <TextField
                                placeholder={t('username')}
                                value={auth.user}
                                onChange={e => setAuth({ ...auth, user: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <TextField
                                placeholder={t('password')}
                                type="password"
                                value={auth.pass}
                                onChange={e => setAuth({ ...auth, pass: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <Button type="submit" variant="contained" size="large">
                                {t('login')}
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
                                {t('session_expired')}
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Container>
        );
    }

    // Dashboard view
    if (dashboard && !editRow) {
        return (
            <AdminLayout
                maxWidth="md"
                showBackToGame={true}
                showLogout={true}
                onLogout={handleLogout}
            >
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        {t('admin_dashboard')}
                    </Typography>
                    <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                        {t('welcome_user', { username: currentUser?.username, role: currentUser?.role })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'root_admin' || currentUser?.role === 'administrative') && (
                            <Button
                                onClick={() => {
                                    if (languageSetsLoading) return;
                                    if (languageSets.length === 0) {
                                        setDashboard(false);
                                        setLanguageSetManagement(true);
                                    } else {
                                        setDashboard(false);
                                    }
                                }}
                                variant="contained"
                                disabled={languageSetsLoading}
                            >
                                {t('browse_phrases')}
                            </Button>
                        )}
                        {(currentUser?.role === 'root_admin' || currentUser?.role === 'administrative') && (
                            <Button
                                onClick={() => {
                                    setDashboard(false);
                                    setUserManagement(true);
                                }}
                                variant="contained"
                                color="secondary"
                            >
                                {t('user_management')}
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                setDashboard(false);
                                setLanguageSetManagement(true);
                            }}
                            variant="contained"
                            color="warning"
                        >
                            {currentUser?.role === 'admin' || currentUser?.role === 'root_admin' || currentUser?.role === 'administrative' 
                                ? t('language_sets_management')
                                : t('manage_ignored_categories', 'Manage Ignored Categories')
                            }
                        </Button>
                        {currentUser?.role === 'root_admin' && (
                            <Button
                                onClick={() => {
                                    setDashboard(false);
                                    setDuplicateManagement(true);
                                }}
                                variant="contained"
                                color="error"
                            >
                                {t('duplicate_management', 'Duplicate Management')}
                            </Button>
                        )}
                        {(currentUser?.role === 'root_admin' || currentUser?.role === 'administrative') && (
                            <Button
                                onClick={() => {
                                    setDashboard(false);
                                    setStatisticsDashboard(true);
                                }}
                                variant="contained"
                                color="success"
                            >
                                {t('statistics_dashboard')}
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
                            {t('your_profile')}
                        </Button>
                    </Box>
                    {error && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                            <Typography color="error.contrastText">{error}</Typography>
                        </Box>
                    )}
                </Paper>
            </AdminLayout>
        );
    }

    // User Management View
    if (userManagement) {
        return (
            <AdminLayout
                showBackToGame={true}
                showDashboard={true}
                showLogout={true}
                onDashboard={() => {
                    setUserManagement(false);
                    setDuplicateManagement(false);
                    setDashboard(true);
                }}
                onLogout={handleLogout}
            >
                <Paper sx={{ p: 3 }}>
                    <UserManagement currentUser={currentUser} />
                </Paper>
            </AdminLayout>
        );
    }

    // Statistics Dashboard View
    if (statisticsDashboard) {
        return (
            <AdminLayout
                showBackToGame={true}
                showDashboard={true}
                showLogout={true}
                onDashboard={() => {
                    setStatisticsDashboard(false);
                    setDuplicateManagement(false);
                    setDashboard(true);
                }}
                onLogout={handleLogout}
            >
                <StatisticsDashboard token={token} setError={setError} currentUser={currentUser} />
            </AdminLayout>
        );
    }

    // Language Sets Management View
    if (languageSetManagement) {
        return (
            <AdminLayout
                showBackToGame={true}
                showDashboard={true}
                showLogout={true}
                onDashboard={() => {
                    setLanguageSetManagement(false);
                    setDuplicateManagement(false);
                    setDashboard(true);
                }}
                onLogout={handleLogout}
            >
                <Paper sx={{ p: 3 }}>
                    <LanguageSetManagement 
                        currentUser={currentUser} 
                        initialLanguageSets={languageSets}
                        initialCategories={categories}
                        showAdminActions={currentUser?.role === 'admin' || currentUser?.role === 'root_admin' || currentUser?.role === 'administrative'}
                    />
                </Paper>
            </AdminLayout>
        );
    }

    // User Profile View
    if (userProfile) {
        return (
            <AdminLayout
                maxWidth="md"
                showBackToGame={true}
                showDashboard={true}
                showLogout={true}
                onDashboard={() => {
                    setUserProfile(false);
                    setDuplicateManagement(false);
                    setDashboard(true);
                }}
                onLogout={handleLogout}
            >
                <UserProfile currentUser={currentUser} />
            </AdminLayout>
        );
    }

    // Duplicate Management View
    if (duplicateManagement) {
        return (
            <AdminLayout
                showBackToGame={true}
                showDashboard={true}
                showLogout={true}
                onDashboard={() => {
                    setDuplicateManagement(false);
                    setDashboard(true);
                }}
                onLogout={handleLogout}
            >
                <Paper sx={{ p: 3 }}>
                    <DuplicateManagement 
                        currentUser={currentUser} 
                        selectedLanguageSetId={selectedLanguageSetId}
                    />
                </Paper>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout
            showBackToGame={true}
            showDashboard={true}
            showLogout={true}
            onDashboard={() => {
                setDashboard(true);
                setUserManagement(false);
                setLanguageSetManagement(false);
                setDuplicateManagement(false);
                setUserProfile(false);
                setStatisticsDashboard(false);
            }}
            onLogout={handleLogout}
        >
            {/* Error overlay for no language sets */}
            {languageSets.length === 0 && !dashboard && !languageSetsLoading && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: isDarkMode ? 'rgba(30,30,30,0.9)' : 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                >
                    <Box
                        sx={{
                            backgroundColor: isDarkMode ? '#222' : 'white',
                            color: isDarkMode ? '#fff' : 'inherit',
                            borderRadius: 2,
                            p: 4,
                            maxWidth: 500,
                            mx: 2,
                            textAlign: 'center',
                            boxShadow: isDarkMode ? 8 : 2
                        }}
                    >
                        <Typography variant="h5" gutterBottom color="error">
                            {t('no_language_sets_title')}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 3 }}>
                            {t('no_language_sets_message')}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                setDashboard(true);
                                setLanguageSetManagement(true);
                            }}
                            sx={{ mr: 2 }}
                        >
                            {t('go_to_language_sets')}
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => setDashboard(true)}
                        >
                            {t('back_to_dashboard')}
                        </Button>
                    </Box>
                </Box>
            )}
            
            {/* Browse Records Interface - Admin Only */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'root_admin' || currentUser?.role === 'administrative') ? (
                <>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        {t('admin_panel')}
                    </Typography>
            {/* Action Buttons */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={2} justifyContent="center">
                    <Grid item xs={6} sm={4} md={2}>
                        <ResponsiveActionButton
                            onClick={() => {
                                if (selectedLanguageSetId) {
                                    setReloadLoading(true);
                                    fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId);
                                    setTimeout(() => setReloadLoading(false), 500);
                                }
                            }}
                            loading={reloadLoading}
                            icon="📊"
                            desktopText={t('reload_data')}
                            mobileText={t('reload')}
                        />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <ResponsiveActionButton
                            onClick={() => setEditRow({ categories: '', phrase: '', translation: '' })}
                            color="secondary"
                            icon="➕"
                            desktopText={t('add_row')}
                            mobileText={t('add')}
                        />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <Box sx={{ height: '100%', display: 'flex' }}>
                            <UploadForm selectedLanguageSetId={selectedLanguageSetId} onUpload={() => selectedLanguageSetId && fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId)} />
                        </Box>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <ResponsiveActionButton
                            onClick={() => handleExportTxt(filterCategory)}
                            variant="outlined"
                            color="success"
                            icon="💾"
                            desktopText={t('download_phrases')}
                            mobileText={t('download')}
                        />
                    </Grid>
                    {/* Clear Database Button - Root Admin Only */}
                    {currentUser?.role === 'root_admin' && (
                        <Grid item xs={12} sm={4} md={2}>
                            <ResponsiveActionButton
                                onClick={handleClearDb}
                                loading={clearLoading}
                                icon="🗑️"
                                desktopText={t('clear_database')}
                                mobileText={t('clear')}
                                sx={{
                                    bgcolor: 'error.main',
                                    color: 'white',
                                    '&:hover': {
                                        bgcolor: 'error.dark',
                                    }
                                }}
                            />
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
                    )}
                </Grid>
            </Paper>
            {/* Edit Row Form */}
            <EditRowForm
                editRow={editRow}
                setEditRow={setEditRow}
                handleSave={() => handleSave(editRow, () => selectedLanguageSetId && fetchRows(offset, limit, filterCategory, searchTerm, selectedLanguageSetId), setEditRow)}
            />
            {/* Filter and Statistics */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3} alignItems="center">
                    {/* Language Set Filter */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth sx={{ minWidth: 200 }}>
                            <InputLabel>{t('filter_by_language_set')}</InputLabel>
                            <Select
                                value={selectedLanguageSetId || ''}
                                label={t('filter_by_language_set')}
                                onChange={e => {
                                    const value = parseInt(e.target.value);
                                    setSelectedLanguageSetId(value);
                                    setOffset(0);
                                    setFilterCategory(''); // Reset category filter when language set changes
                                    // Save to localStorage
                                    localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, value.toString());
                                }}
                            >
                                {languageSets.map(set => (
                                    <MenuItem key={set.id} value={set.id}>{set.display_name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Category Filter */}
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth sx={{ minWidth: 200 }}>
                            <InputLabel>{t('filter_by_category')}</InputLabel>
                            <Select
                                value={filterCategory}
                                label={t('filter_by_category')}
                                onChange={e => { setFilterCategory(e.target.value); setOffset(0); }}
                            >
                                <MenuItem value="">{`-- ${t('all_categories')} --`}</MenuItem>
                                {categories.map(cat => (
                                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                {/* Ignored Categories Display - New Row */}
                {((currentUser && selectedLanguageSetId) || ignoredCategories.length > 0 || userIgnoredCategories.length > 0) && (
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowIgnoredCategories(!showIgnoredCategories)}
                            startIcon={<ExpandMoreIcon
                                style={{
                                    transform: showIgnoredCategories ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s'
                                }}
                            />}
                            sx={{ mb: showIgnoredCategories ? 1 : 0 }}
                        >
                            {t('ignored_categories')} ({ignoredCategories.length + userIgnoredCategories.length})
                        </Button>
                        <Collapse in={showIgnoredCategories}>
                            <Box sx={{ mt: 1 }}>
                                {/* User ignored categories */}
                                {currentUser && userIgnoredCategories.length > 0 && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            {t('your_ignored_categories', 'Your Ignored Categories')}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {userIgnoredCategories.map(category => (
                                                <Tooltip key={category} title={t('click_to_remove_ignored', 'Click to remove from ignored categories')}>
                                                    <Chip
                                                        label={category}
                                                        size="small"
                                                        color="warning"
                                                        variant="filled"
                                                        onClick={() => toggleIgnoredCategory(category)}
                                                        sx={{
                                                            cursor: 'pointer',
                                                            textDecoration: 'line-through',
                                                            mb: 0.5
                                                        }}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}

                                {/* Global ignored categories */}
                                {ignoredCategories.length > 0 && (
                                    <Box>
                                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            {t('global_ignored_categories', 'Global Ignored Categories')}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {ignoredCategories.map(category => (
                                                <Tooltip key={category} title={t('ignored_category_tooltip')}>
                                                    <Chip
                                                        label={category}
                                                        size="small"
                                                        color="default"
                                                        variant="outlined"
                                                        sx={{
                                                            opacity: 0.7,
                                                            textDecoration: 'line-through',
                                                            mb: 0.5
                                                        }}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}

                                {/* Message when no categories are ignored yet */}
                                {currentUser && ignoredCategories.length === 0 && userIgnoredCategories.length === 0 && categories.length > 0 && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                            {t('no_ignored_categories_yet', 'No categories are ignored yet. Click on categories below to ignore them.')}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Available categories for logged in users */}
                                {currentUser && categories.length > 0 && (
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            {t('available_categories', 'Available Categories')} ({t('click_to_ignore', 'click to ignore')})
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {categories
                                                .filter(cat => !userIgnoredCategories.includes(cat) && !ignoredCategories.includes(cat))
                                                .map(category => (
                                                    <Tooltip key={category} title={t('click_to_add_ignored', 'Click to add to ignored categories')}>
                                                        <Chip
                                                            label={category}
                                                            size="small"
                                                            color="primary"
                                                            variant="outlined"
                                                            onClick={() => toggleIgnoredCategory(category)}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                mb: 0.5
                                                            }}
                                                        />
                                                    </Tooltip>
                                                ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Box>
                        </Collapse>
                    </Box>
                )}
            </Paper>
            {/* Batch Operations Toolbar */}
            {batchMode && (
                <BatchOperationsToolbar
                    selectedCount={selectedRows.length}
                    onBatchDelete={handleBatchDeleteClick}
                    onBatchAddCategory={handleBatchAddCategoryClick}
                    onBatchRemoveCategory={handleBatchRemoveCategoryClick}
                    disabled={batchLoading || selectedRows.length === 0}
                />
            )}
            {/* Data Table */}
            <AdminTable
                rows={rows}
                setEditRow={setEditRow}
                onSaveRow={handleInlineSave}
                onDeleteRow={handleInlineDelete}
                totalRows={totalRows}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                isLoading={dataLoading}
                batchMode={batchMode}
                selectedRows={selectedRows}
                onRowSelectionChange={handleRowSelectionChange}
                onBatchModeToggle={handleBatchModeToggle}
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
                    pageSizeSelector={
                        <PageSizeSelector
                            value={limit}
                            onChange={handlePageSizeChange}
                        />
                    }
                />
            </Box>
            {/* Error Display */}
            {error && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                    <Typography color="error.contrastText">{error}</Typography>
                </Box>
            )}

            {/* Batch Operation Dialogs */}
            <BatchOperationDialog
                open={batchDialog.open}
                onClose={handleBatchDialogClose}
                operation={batchDialog.operation}
                selectedCount={selectedRows.length}
                onConfirm={handleBatchConfirm}
                availableCategories={categories}
            />

            <BatchResultDialog
                open={batchResult.open}
                onClose={handleBatchResultClose}
                operation={batchResult.operation}
                result={batchResult.result}
            />
            </>) : (
                /* Regular users - Access Denied */
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    minHeight: '400px', 
                    textAlign: 'center' 
                }}>
                    <Typography variant="h5" gutterBottom color="error">
                        {t('access_denied', 'Access Denied')}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3 }}>
                        {t('browse_records_admin_only', 'Browse records is only available for administrators.')}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => setDashboard(true)}
                    >
                        {t('back_to_dashboard')}
                    </Button>
                </Box>
            )}

            {/* Rate Limit Warning */}
            <RateLimitWarning 
                show={showFetchRateLimit}
                onClose={() => {}} // Auto-closes via autoHideDuration
                message={t('admin.rateLimitWarning', 'Please wait before making another request. Data is being processed.')}
            />
        </AdminLayout>
    );
}