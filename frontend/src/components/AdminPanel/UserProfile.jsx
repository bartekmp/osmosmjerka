import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';

export default function UserProfile({ currentUser }) {
    const [profile, setProfile] = useState({
        username: '',
        role: '',
        self_description: ''
    });
    const [description, setDescription] = useState('');
    const [passwordDialog, setPasswordDialog] = useState(false);
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    const authHeader = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await fetch('/admin/profile', {
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                setProfile(data);
                setDescription(data.self_description || '');
            } else {
                showNotification(data.error || 'Failed to fetch profile', 'error');
            }
        } catch (err) {
            showNotification('Network error: ' + err.message, 'error');
        }
    };

    const updateProfile = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/profile', {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify({
                    self_description: description
                })
            });
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Profile updated successfully', 'success');
                setProfile({ ...profile, self_description: description });
            } else {
                showNotification(data.error || 'Failed to update profile', 'error');
            }
        } catch (err) {
            showNotification('Network error: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const changePassword = async () => {
        if (passwordData.new_password !== passwordData.confirm_password) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        if (passwordData.new_password.length < 6) {
            showNotification('New password must be at least 6 characters', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/admin/change-password', {
                method: 'POST',
                headers: authHeader,
                body: JSON.stringify({
                    current_password: passwordData.current_password,
                    new_password: passwordData.new_password
                })
            });
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Password changed successfully', 'success');
                setPasswordDialog(false);
                setPasswordData({
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                });
            } else {
                showNotification(data.error || 'Failed to change password', 'error');
            }
        } catch (err) {
            showNotification('Network error: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message, severity) => {
        setNotification({
            open: true,
            message,
            severity
        });
    };

    if (currentUser?.role === 'root_admin') {
        return (
            <Box>
                <Typography variant="h5" sx={{ mb: 3 }}>User Profile</Typography>
                <Alert severity="info">
                    Root admin profile cannot be modified through this interface.
                </Alert>
                <Paper sx={{ p: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Account Information</Typography>
                    <Typography><strong>Username:</strong> {currentUser.username}</Typography>
                    <Typography><strong>Role:</strong> {currentUser.role}</Typography>
                    <Typography><strong>Description:</strong> Root Administrator</Typography>
                </Paper>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>User Profile</Typography>
            
            {/* Account Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Account Information</Typography>
                <Typography sx={{ mb: 1 }}><strong>Username:</strong> {profile.username}</Typography>
                <Typography sx={{ mb: 2 }}><strong>Role:</strong> {profile.role}</Typography>
                
                <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    sx={{ mb: 2 }}
                />
                
                <Button 
                    variant="contained" 
                    onClick={updateProfile}
                    disabled={loading || !description.trim()}
                    sx={{ mr: 2 }}
                >
                    Update Description
                </Button>
                
                <Button 
                    variant="outlined" 
                    onClick={() => setPasswordDialog(true)}
                >
                    Change Password
                </Button>
            </Paper>

            {/* Change Password Dialog */}
            <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Change Password</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label="Current Password"
                            type="password"
                            value={passwordData.current_password}
                            onChange={(e) => setPasswordData({
                                ...passwordData, 
                                current_password: e.target.value
                            })}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="New Password"
                            type="password"
                            value={passwordData.new_password}
                            onChange={(e) => setPasswordData({
                                ...passwordData, 
                                new_password: e.target.value
                            })}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="Confirm New Password"
                            type="password"
                            value={passwordData.confirm_password}
                            onChange={(e) => setPasswordData({
                                ...passwordData, 
                                confirm_password: e.target.value
                            })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={changePassword}
                        variant="contained"
                        disabled={loading || !passwordData.current_password || !passwordData.new_password}
                    >
                        Change Password
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
