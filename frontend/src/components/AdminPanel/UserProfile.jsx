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
import { useTranslation } from 'react-i18next';

export default function UserProfile({ currentUser }) {
    const { t } = useTranslation();
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
                showNotification(data.error || t('fetch_profile_failed'), 'error');
            }
        } catch (err) {
            showNotification(t('network_error', { message: err.message }), 'error');
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
                showNotification(t('profile_updated'), 'success');
                setProfile({ ...profile, self_description: description });
            } else {
                showNotification(data.error || t('update_profile_failed'), 'error');
            }
        } catch (err) {
            showNotification(t('network_error', { message: err.message }), 'error');
        } finally {
            setLoading(false);
        }
    };

    const changePassword = async () => {
        if (passwordData.new_password !== passwordData.confirm_password) {
            showNotification(t('passwords_do_not_match'), 'error');
            return;
        }

        if (passwordData.new_password.length < 6) {
            showNotification(t('password_too_short'), 'error');
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
                showNotification(t('password_changed'), 'success');
                setPasswordDialog(false);
                setPasswordData({
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                });
            } else {
                showNotification(data.error || t('change_password_failed'), 'error');
            }
        } catch (err) {
            showNotification(t('network_error', { message: err.message }), 'error');
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
                <Typography variant="h5" sx={{ mb: 3 }}>{t('user_profile')}</Typography>
                <Alert severity="info">
                    {t('root_admin_profile_readonly')}
                </Alert>
                <Paper sx={{ p: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>{t('account_information')}</Typography>
                    <Typography><strong>{t('username')}:</strong> {currentUser.username}</Typography>
                    <Typography><strong>{t('role')}:</strong> {currentUser.role}</Typography>
                    <Typography><strong>{t('description')}:</strong> {t('root_administrator')}</Typography>
                </Paper>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>{t('user_profile')}</Typography>
            {/* Account Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('account_information')}</Typography>
                <Typography sx={{ mb: 1 }}><strong>{t('username')}:</strong> {profile.username}</Typography>
                <Typography sx={{ mb: 2 }}><strong>{t('role')}:</strong> {profile.role}</Typography>
                <TextField
                    fullWidth
                    label={t('description')}
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
                    {t('update_description')}
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={() => setPasswordDialog(true)}
                >
                    {t('change_password')}
                </Button>
            </Paper>
            {/* Change Password Dialog */}
            <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('change_password')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label={t('current_password')}
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
                            label={t('new_password')}
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
                            label={t('confirm_new_password')}
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
                    <Button onClick={() => setPasswordDialog(false)}>{t('cancel')}</Button>
                    <Button 
                        onClick={changePassword}
                        variant="contained"
                        disabled={loading || !passwordData.current_password || !passwordData.new_password}
                    >
                        {t('change_password')}
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
