import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    IconButton,
    Snackbar,
    Alert
} from '@mui/material';
import { Edit, Delete, Add, PersonAdd } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export default function UserManagement({ currentUser }) {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
    const [selectedUser, setSelectedUser] = useState(null);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'regular',
        self_description: ''
    });

    const authHeader = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/users', {
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                setUsers(data.users || []);
            } else {
                setError(data.error || t('failed_to_fetch_users'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        try {
            const response = await fetch('/admin/users', {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (response.ok) {
                setNotification({
                    open: true,
                    message: t('user_created_successfully'),
                    severity: 'success'
                });
                fetchUsers();
                handleCloseDialog();
            } else {
                setError(data.error || t('failed_to_create_user'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
        }
    };

    const handleUpdateUser = async () => {
        try {
            const updateData = {
                role: formData.role,
                self_description: formData.self_description,
                is_active: true
            };

            const response = await fetch(`/admin/users/${selectedUser.id}`, {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify(updateData)
            });
            const data = await response.json();

            if (response.ok) {
                setNotification({
                    open: true,
                    message: t('user_updated_successfully'),
                    severity: 'success'
                });
                fetchUsers();
                handleCloseDialog();
            } else {
                setError(data.error || t('failed_to_update_user'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm(t('confirm_delete_user'))) {
            try {
                const response = await fetch(`/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: authHeader
                });
                const data = await response.json();

                if (response.ok) {
                    setNotification({
                        open: true,
                        message: t('user_deleted_successfully'),
                        severity: 'success'
                    });
                    fetchUsers();
                } else {
                    setError(data.error || t('failed_to_delete_user'));
                }
            } catch (err) {
                setError(t('network_error', { message: err.message }));
            }
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = prompt(t('enter_new_password_for_user'));
        if (newPassword) {
            try {
                const response = await fetch(`/admin/users/${userId}/reset-password`, {
                    method: 'POST',
                    headers: authHeader,
                    body: JSON.stringify({ new_password: newPassword })
                });
                const data = await response.json();

                if (response.ok) {
                    setNotification({
                        open: true,
                        message: t('password_reset_successfully'),
                        severity: 'success'
                    });
                } else {
                    setError(data.error || t('failed_to_reset_password'));
                }
            } catch (err) {
                setError(t('network_error', { message: err.message }));
            }
        }
    };

    const handleOpenDialog = (mode, user = null) => {
        setDialogMode(mode);
        setSelectedUser(user);

        if (mode === 'create') {
            setFormData({
                username: '',
                password: '',
                role: 'regular',
                self_description: ''
            });
        } else {
            setFormData({
                username: user.username,
                password: '',
                role: user.role,
                self_description: user.self_description || ''
            });
        }

        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedUser(null);
        setFormData({
            username: '',
            password: '',
            role: 'regular',
            self_description: ''
        });
    };

    const handleSubmit = () => {
        if (dialogMode === 'create') {
            handleCreateUser();
        } else {
            handleUpdateUser();
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'root_admin':
                return 'error';
            case 'administrative':
                return 'warning';
            default:
                return 'default';
        }
    };

    if (loading) {
        return <Typography>{t('loading_users')}</Typography>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">{t('user_management')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<PersonAdd />}
                        onClick={() => handleOpenDialog('create')}
                    >
                        {t('create_user')}
                    </Button>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('username')}</TableCell>
                            <TableCell>{t('role')}</TableCell>
                            <TableCell>{t('description')}</TableCell>
                            <TableCell>{t('created')}</TableCell>
                            <TableCell>{t('last_login')}</TableCell>
                            <TableCell>{t('actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.role}
                                        color={getRoleColor(user.role)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{user.self_description || '-'}</TableCell>
                                <TableCell>
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell>
                                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenDialog('edit', user)}
                                        title={t('edit_user')}
                                    >
                                        <Edit />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleResetPassword(user.id)}
                                        title={t('reset_password')}
                                    >
                                        🔑
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteUser(user.id)}
                                        title={t('delete_user')}
                                        disabled={user.id === 0}
                                    >
                                        <Delete />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Create/Edit User Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {dialogMode === 'create' ? t('create_new_user') : t('edit_user')}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label={t('username')}
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            disabled={dialogMode === 'edit'}
                            sx={{ mb: 2 }}
                        />

                        {dialogMode === 'create' && (
                            <TextField
                                fullWidth
                                label={t('password')}
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                sx={{ mb: 2 }}
                            />
                        )}

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>{t('role')}</InputLabel>
                            <Select
                                value={formData.role}
                                label={t('role')}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <MenuItem value="regular">{t('regular')}</MenuItem>
                                <MenuItem value="administrative">{t('administrative')}</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label={t('description')}
                            multiline
                            rows={3}
                            value={formData.self_description}
                            onChange={(e) => setFormData({ ...formData, self_description: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>{t('cancel')}</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={!formData.username || (dialogMode === 'create' && !formData.password)}
                    >
                        {dialogMode === 'create' ? t('create') : t('update')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Notification Snackbar */}
            <Snackbar
                open={notification.open}
                autoHideDuration={3000}
                onClose={() => setNotification({ ...notification, open: false })}
            >
                <Alert
                    onClose={() => setNotification({ ...notification, open: false })}
                    severity={notification.severity}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
