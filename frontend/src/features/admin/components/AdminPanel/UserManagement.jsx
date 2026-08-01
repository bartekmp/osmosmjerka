import { authHeaders } from '@shared/utils/apiClient';
import { Block, CheckCircle, Delete, Edit, MarkEmailRead, PersonAdd, Send, VpnKey } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
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

    const authHeader = authHeaders({ 'Content-Type': 'application/json' });

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
            // is_active is deliberately absent: this dialog edits the role and the
            // description, and sending a hardcoded `true` here used to silently re-enable
            // a banned account whenever anyone tweaked its role. Enabling and disabling is
            // the toggle's job.
            const updateData = {
                role: formData.role,
                self_description: formData.self_description
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

    // Manual confirmation, for when the emailed link never arrived (bounced, spam-filtered,
    // or the SMTP server was down). The account can log in immediately afterwards.
    const handleConfirmEmail = async (userId) => {
        if (!window.confirm(t('confirm_email_prompt'))) return;
        try {
            const response = await fetch(`/admin/users/${userId}/confirm-email`, {
                method: 'POST',
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                setNotification({ open: true, message: t('email_confirmed_successfully'), severity: 'success' });
                fetchUsers();
            } else {
                setError(data.error || t('failed_to_confirm_email'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
        }
    };

    const handleResendVerification = async (userId) => {
        try {
            const response = await fetch(`/admin/users/${userId}/resend-verification`, {
                method: 'POST',
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                setNotification({ open: true, message: data.message, severity: 'success' });
            } else {
                setError(data.error || data.detail || t('failed_to_resend_verification'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
        }
    };

    // Disabling an account also ends its live sessions server-side, so a ban takes effect
    // on the very next request rather than whenever the user's token happens to expire.
    const handleToggleActive = async (targetUser) => {
        const disabling = targetUser.is_active !== false;
        if (disabling && !window.confirm(t('confirm_disable_user', { username: targetUser.username }))) return;

        try {
            const response = await fetch(`/admin/users/${targetUser.id}`, {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify({ is_active: !disabling })
            });
            const data = await response.json();

            if (response.ok) {
                setNotification({
                    open: true,
                    message: disabling ? t('user_disabled') : t('user_enabled'),
                    severity: 'success'
                });
                fetchUsers();
            } else {
                setError(data.error || data.detail || t('failed_to_update_user'));
            }
        } catch (err) {
            setError(t('network_error', { message: err.message }));
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
        <Paper sx={{ p: 3 }}>
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
                            <TableCell>{t('auth.email')}</TableCell>
                            <TableCell>{t('role')}</TableCell>
                            <TableCell>{t('status')}</TableCell>
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
                                    {user.email ? (
                                        <Box>
                                            <Typography variant="body2">{user.email}</Typography>
                                            <Chip
                                                label={user.email_verified ? t('email_confirmed') : t('email_pending')}
                                                color={user.email_verified ? 'success' : 'warning'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">-</Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.role}
                                        color={getRoleColor(user.role)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={user.is_active === false ? t('disabled') : t('active')}
                                        color={user.is_active === false ? 'error' : 'success'}
                                        size="small"
                                        variant={user.is_active === false ? 'filled' : 'outlined'}
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
                                        disabled={user.id === 0 && currentUser?.role !== 'root_admin'}
                                    >
                                        <Edit />
                                    </IconButton>
                                    {user.email && !user.email_verified && (
                                        <>
                                            <IconButton
                                                size="small"
                                                color="success"
                                                onClick={() => handleConfirmEmail(user.id)}
                                                title={t('confirm_email')}
                                            >
                                                <MarkEmailRead fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleResendVerification(user.id)}
                                                title={t('resend_verification')}
                                            >
                                                <Send fontSize="small" />
                                            </IconButton>
                                        </>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => handleResetPassword(user.id)}
                                        title={t('reset_password')}
                                        disabled={user.id === 0 && currentUser?.role !== 'root_admin'}
                                    >
                                        <VpnKey fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color={user.is_active === false ? 'success' : 'warning'}
                                        onClick={() => handleToggleActive(user)}
                                        title={user.is_active === false ? t('enable_user') : t('disable_user')}
                                        // The root admin cannot be locked out of their own
                                        // instance, and neither can you lock out yourself.
                                        disabled={user.id === 0 || user.id === currentUser?.id}
                                    >
                                        {user.is_active === false ? <CheckCircle fontSize="small" /> : <Block fontSize="small" />}
                                    </IconButton>
                                    {currentUser?.role === 'root_admin' && (
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleDeleteUser(user.id)}
                                            title={t('delete_user')}
                                            disabled={user.id === 0 || user.id === currentUser?.id}
                                        >
                                            <Delete />
                                        </IconButton>
                                    )}
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
                                disabled={selectedUser?.id === 0} // Disable role editing for root admin
                            >
                                <MenuItem value="regular">{t('regular')}</MenuItem>
                                <MenuItem value="administrative">{t('administrative')}</MenuItem>
                                {(selectedUser?.id === 0 || formData.role === 'root_admin') && (
                                    <MenuItem value="root_admin">{t('root_admin')}</MenuItem>
                                )}
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
        </Paper>
    );
}
