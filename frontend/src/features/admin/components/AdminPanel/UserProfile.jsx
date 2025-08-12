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
    DialogActions,
    Chip,
    Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '@shared';

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
    const [ignoredSummary, setIgnoredSummary] = useState({});
    const [modifiedIgnoredSummary, setModifiedIgnoredSummary] = useState({});
    const [languageSets, setLanguageSets] = useState([]);

    const authHeader = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
    };

    useEffect(() => {
        fetchProfile();
        fetchIgnoredSummary();
        fetchLanguageSets();
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

    const fetchIgnoredSummary = async () => {
        try {
            const res = await fetch(API_ENDPOINTS.USER_IGNORED_CATEGORIES_ALL, { headers: authHeader });
            if (res.ok) {
                const data = await res.json();
                setIgnoredSummary(data);
                setModifiedIgnoredSummary(data);
            }
        } catch (e) {
            // silent fail
        }
    };

    const fetchLanguageSets = async () => {
        try {
            const res = await fetch(API_ENDPOINTS.LANGUAGE_SETS);
            if (res.ok) {
                const data = await res.json();
                setLanguageSets(data);
            }
        } catch (_) { /* ignore */ }
    };

    const removeIgnoredCategory = (languageSetId, category) => {
        setModifiedIgnoredSummary(prev => {
            const newSummary = { ...prev };
            if (newSummary[languageSetId]) {
                newSummary[languageSetId] = newSummary[languageSetId].filter(cat => cat !== category);
                if (newSummary[languageSetId].length === 0) {
                    delete newSummary[languageSetId];
                }
            }
            return newSummary;
        });
    };

    const hasIgnoredChanges = () => {
        return JSON.stringify(ignoredSummary) !== JSON.stringify(modifiedIgnoredSummary);
    };

    const updateProfile = async () => {
        setLoading(true);
        try {
            // Update profile description
            const response = await fetch('/admin/profile', {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify({
                    self_description: description
                })
            });
            const data = await response.json();

            if (!response.ok) {
                showNotification(data.error || t('update_profile_failed'), 'error');
                return;
            }

            // Update ignored categories if they changed
            if (hasIgnoredChanges()) {
                const ignoredPromises = [];
                
                // Update each language set's ignored categories
                for (const [languageSetId, categories] of Object.entries(modifiedIgnoredSummary)) {
                    ignoredPromises.push(
                        fetch('/api/user/ignored-categories', {
                            method: 'PUT',
                            headers: authHeader,
                            body: JSON.stringify({
                                language_set_id: parseInt(languageSetId),
                                categories: categories
                            })
                        })
                    );
                }

                // Handle deleted language sets (no categories left)
                for (const languageSetId of Object.keys(ignoredSummary)) {
                    if (!modifiedIgnoredSummary[languageSetId]) {
                        ignoredPromises.push(
                            fetch('/api/user/ignored-categories', {
                                method: 'PUT',
                                headers: authHeader,
                                body: JSON.stringify({
                                    language_set_id: parseInt(languageSetId),
                                    categories: []
                                })
                            })
                        );
                    }
                }

                await Promise.all(ignoredPromises);
                setIgnoredSummary(modifiedIgnoredSummary);
            }

            showNotification(t('profile_updated'), 'success');
            setProfile({ ...profile, self_description: description });
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

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3 }}>{t('user_profile')}</Typography>
            {/* Account Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('account_information')}</Typography>
                <Typography sx={{ mb: 1 }}><strong>{t('username')}:</strong> {profile.username}</Typography>
                <Typography sx={{ mb: 2 }}><strong>{t('role')}:</strong> {profile.role}</Typography>
                <Button
                    variant="outlined"
                    onClick={() => setPasswordDialog(true)}
                    sx={{ mb: 2 }}
                >
                    {t('change_password')}
                </Button>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('your_ignored_categories', 'Your Ignored Categories')}</Typography>
                {Object.keys(modifiedIgnoredSummary).length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('no_user_ignored_categories', 'You have not ignored any categories yet.')}
                    </Typography>
                )}
                {Object.entries(modifiedIgnoredSummary).map(([lsId, cats]) => {
                    const ls = languageSets.find(l => l.id === Number(lsId));
                    const label = ls ? (ls.display_name || ls.name || `#${lsId}`) : `#${lsId}`;
                    return (
                        <Box key={lsId} sx={{ mb: 2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                {label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {cats.map(c => (
                                    <Chip 
                                        key={c} 
                                        label={c} 
                                        size="small" 
                                        variant="outlined" 
                                        onDelete={() => removeIgnoredCategory(lsId, c)}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    );
                })}
                <Divider sx={{ my: 2 }} />
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
                    disabled={loading || (!description.trim() && !hasIgnoredChanges())}
                >
                    {t('update')}
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
