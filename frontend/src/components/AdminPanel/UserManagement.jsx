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

export default function UserManagement({ currentUser }) {
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
                setError(data.error || 'Failed to fetch users');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
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
                    message: 'User created successfully',
                    severity: 'success'
                });
                fetchUsers();
                handleCloseDialog();
            } else {
                setError(data.error || 'Failed to create user');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
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
                    message: 'User updated successfully',
                    severity: 'success'
                });
                fetchUsers();
                handleCloseDialog();
            } else {
                setError(data.error || 'Failed to update user');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await fetch(`/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: authHeader
                });
                const data = await response.json();
                
                if (response.ok) {
                    setNotification({
                        open: true,
                        message: 'User deleted successfully',
                        severity: 'success'
                    });
                    fetchUsers();
                } else {
                    setError(data.error || 'Failed to delete user');
                }
            } catch (err) {
                setError('Network error: ' + err.message);
            }
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = prompt('Enter new password for user:');
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
                        message: 'Password reset successfully',
                        severity: 'success'
                    });
                } else {
                    setError(data.error || 'Failed to reset password');
                }
            } catch (err) {
                setError('Network error: ' + err.message);
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
        return <Typography>Loading users...</Typography>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">User Management</Typography>
                <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={() => handleOpenDialog('create')}
                >
                    Create User
                </Button>
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
                            <TableCell>Username</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Last Login</TableCell>
                            <TableCell>Actions</TableCell>
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
                                        title="Edit User"
                                    >
                                        <Edit />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleResetPassword(user.id)}
                                        title="Reset Password"
                                    >
                                        🔑
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteUser(user.id)}
                                        title="Delete User"
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
                    {dialogMode === 'create' ? 'Create New User' : 'Edit User'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label="Username"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            disabled={dialogMode === 'edit'}
                            sx={{ mb: 2 }}
                        />
                        
                        {dialogMode === 'create' && (
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                sx={{ mb: 2 }}
                            />
                        )}
                        
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.role}
                                label="Role"
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            >
                                <MenuItem value="regular">Regular</MenuItem>
                                <MenuItem value="administrative">Administrative</MenuItem>
                            </Select>
                        </FormControl>
                        
                        <TextField
                            fullWidth
                            label="Description"
                            multiline
                            rows={3}
                            value={formData.self_description}
                            onChange={(e) => setFormData({ ...formData, self_description: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={!formData.username || (dialogMode === 'create' && !formData.password)}
                    >
                        {dialogMode === 'create' ? 'Create' : 'Update'}
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
