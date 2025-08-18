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
    Divider,
    Grid,
    Card,
    CardContent,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    LinearProgress,
    useTheme,
    Switch,
    FormControlLabel,
    FormControl,
    RadioGroup,
    Radio
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    Timer as TimerIcon,
    Star as StarIcon,
    Edit as EditIcon,
    Add as AddIcon,
    EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '@shared';

export default function UserProfile({ currentUser }) {
    const { t } = useTranslation();
    const theme = useTheme();
    
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
    
    // Statistics state
    const [statistics, setStatistics] = useState(null);
    const [statisticsLoading, setStatisticsLoading] = useState(true);
    const [statisticsError, setStatisticsError] = useState(null);

    // Progressive hints user preference
    const [progressiveHintsEnabled, setProgressiveHintsEnabled] = useState(null); // null = use global setting
    const [progressiveHintsLoading, setProgressiveHintsLoading] = useState(false);

    const authHeader = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
    };

    useEffect(() => {
        fetchProfile();
        fetchIgnoredSummary();
        fetchLanguageSets();
        loadStatistics();
        loadProgressiveHintsPreference();
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

    const loadStatistics = async () => {
        setStatisticsLoading(true);
        setStatisticsError(null);
        
        try {
            const response = await fetch('/admin/statistics/user-profile', {
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                setStatistics(data);
            } else {
                setStatisticsError(data.error || t('failed_to_load_statistics'));
            }
        } catch (err) {
            setStatisticsError(err.message);
        } finally {
            setStatisticsLoading(false);
        }
    };

    const loadProgressiveHintsPreference = async () => {
        try {
            const response = await fetch('/api/user/preferences', {
                headers: authHeader
            });
            const data = await response.json();
            if (response.ok) {
                const hintsPreference = data.progressive_hints_enabled;
                // Convert string to boolean, null means use global setting
                if (hintsPreference === 'true') {
                    setProgressiveHintsEnabled(true);
                } else if (hintsPreference === 'false') {
                    setProgressiveHintsEnabled(false);
                } else {
                    setProgressiveHintsEnabled(null); // Use global setting
                }
            }
        } catch (err) {
            // Silent fail, use global setting
            setProgressiveHintsEnabled(null);
        }
    };

    const updateProgressiveHintsPreference = async (enabled) => {
        setProgressiveHintsLoading(true);
        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify({
                    preference_key: 'progressive_hints_enabled',
                    preference_value: enabled === null ? '' : enabled.toString()
                })
            });
            
            if (response.ok) {
                setProgressiveHintsEnabled(enabled);
                showNotification(
                    enabled === null 
                        ? t('progressive_hints_preference_reset', 'Progressive hints preference reset to global setting')
                        : t('progressive_hints_preference_updated', `Progressive hints ${enabled ? 'enabled' : 'disabled'} for your account`),
                    'success'
                );
            } else {
                const data = await response.json();
                showNotification(data.error || t('failed_to_update_progressive_hints_preference', 'Failed to update progressive hints preference'), 'error');
            }
        } catch (err) {
            showNotification(t('network_error', { message: err.message }), 'error');
        } finally {
            setProgressiveHintsLoading(false);
        }
    };

    const formatTime = (seconds) => {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return t('never');
        return new Date(dateString).toLocaleDateString();
    };

    const getCompletionRate = (completed, started) => {
        if (!started) return 0;
        return Math.round((completed / started) * 100);
    };

    const removeIgnoredCategory = async (languageSetId, category) => {
        try {
            setLoading(true);
            
            // Update local state first
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

            // Get updated categories for this language set
            const updatedCategories = modifiedIgnoredSummary[languageSetId]?.filter(cat => cat !== category) || [];
            
            // Save immediately to server
            const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'application/json' };
            const response = await fetch('/api/user/ignored-categories', {
                method: 'PUT',
                headers: authHeader,
                body: JSON.stringify({
                    language_set_id: parseInt(languageSetId),
                    categories: updatedCategories
                })
            });

            if (!response.ok) {
                throw new Error(t('failed_to_update_ignored_categories'));
            }

            // Update the original state to reflect the saved changes
            setIgnoredSummary(prev => {
                const newSummary = { ...prev };
                if (updatedCategories.length === 0) {
                    delete newSummary[languageSetId];
                } else {
                    newSummary[languageSetId] = updatedCategories;
                }
                return newSummary;
            });

            showNotification(t('ignored_category_removed', 'Ignored category removed successfully'), 'success');
        } catch (err) {
            // Revert local state on error
            fetchIgnoredSummary();
            showNotification(t('failed_to_remove_ignored_category', 'Failed to remove ignored category'), 'error');
        } finally {
            setLoading(false);
        }
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

            showNotification(t('description_updated', 'Description updated successfully'), 'success');
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
            </Paper>

            {/* Statistics Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    <TrophyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {t('your_statistics', 'Your Statistics')}
                </Typography>
                
                {statisticsLoading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress />
                    </Box>
                ) : statisticsError ? (
                    <Alert severity="error">
                        {t('error')}: {statisticsError}
                    </Alert>
                ) : statistics ? (
                    <Box>
                        {/* Overall Statistics */}
                        <Typography variant="subtitle1" gutterBottom color="primary">
                            {t('overall_statistics')}
                        </Typography>
                        
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ textAlign: 'center', p: 2 }}>
                                    <Typography variant="h4" color="primary">
                                        {statistics.overall_statistics?.games_completed || 0}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('games_completed')}
                                    </Typography>
                                </Card>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ textAlign: 'center', p: 2 }}>
                                    <Typography variant="h4" color="success.main">
                                        {getCompletionRate(
                                            statistics.overall_statistics?.games_completed || 0,
                                            statistics.overall_statistics?.games_started || 0
                                        )}%
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('completion_rate')}
                                    </Typography>
                                    <LinearProgress 
                                        variant="determinate" 
                                        value={getCompletionRate(
                                            statistics.overall_statistics?.games_completed || 0,
                                            statistics.overall_statistics?.games_started || 0
                                        )}
                                        sx={{ mt: 1 }}
                                    />
                                </Card>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ textAlign: 'center', p: 2 }}>
                                    <Typography variant="h4" color="info.main">
                                        {statistics.overall_statistics?.total_phrases_found || 0}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('total_phrases_found')}
                                    </Typography>
                                </Card>
                            </Grid>
                            
                            <Grid item xs={12} sm={6} md={3}>
                                <Card sx={{ textAlign: 'center', p: 2 }}>
                                    <Typography variant="h4" color="warning.main">
                                        {formatTime(statistics.overall_statistics?.total_time_played_seconds || 0)}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('time_played')}
                                    </Typography>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Language Set Statistics */}
                        {statistics.language_set_statistics && statistics.language_set_statistics.length > 0 && (
                            <Box>
                                <Typography variant="subtitle1" gutterBottom color="primary">
                                    {t('by_language_set')}
                                </Typography>
                                
                                <Grid container spacing={2}>
                                    {statistics.language_set_statistics.map((langSet, index) => (
                                        <Grid item xs={12} md={6} key={index}>
                                            <Card sx={{ p: 2 }}>
                                                <Typography variant="h6" gutterBottom>
                                                    {langSet.language_set_name}
                                                </Typography>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="body2" color="textSecondary">
                                                            {t('completed')}: {langSet.games_completed || 0}
                                                        </Typography>
                                                        <Typography variant="body2" color="textSecondary">
                                                            {t('phrases_found')}: {langSet.total_phrases_found || 0}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="body2" color="textSecondary">
                                                            {t('time_played')}: {formatTime(langSet.total_time_played_seconds || 0)}
                                                        </Typography>
                                                        <Typography variant="body2" color="textSecondary">
                                                            {t('last_played')}: {formatDate(langSet.last_played)}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Alert severity="info">
                        {t('no_statistics_available', 'No statistics available yet. Start playing some games!')}
                    </Alert>
                )}
            </Paper>

            {/* Profile Settings */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{t('profile_settings', 'Profile Settings')}</Typography>
                <Divider sx={{ my: 2 }} />
                
                {/* Progressive Hints Setting */}
                <Typography variant="subtitle1" sx={{ mb: 2 }}>{t('progressive_hints_setting', 'Progressive Hints Preference')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('progressive_hints_setting_description', 'Choose whether to enable progressive hints for your account. This setting overrides the global system setting.')}
                </Typography>
                <FormControl component="fieldset" sx={{ mb: 3 }}>
                    <RadioGroup
                        value={progressiveHintsEnabled === null ? 'global' : progressiveHintsEnabled.toString()}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'global') {
                                updateProgressiveHintsPreference(null);
                            } else {
                                updateProgressiveHintsPreference(value === 'true');
                            }
                        }}
                        disabled={progressiveHintsLoading}
                    >
                        <FormControlLabel 
                            value="global" 
                            control={<Radio />} 
                            label={t('use_global_setting', 'Use global system setting')} 
                        />
                        <FormControlLabel 
                            value="true" 
                            control={<Radio />} 
                            label={t('enable_progressive_hints', 'Enable progressive hints')} 
                        />
                        <FormControlLabel 
                            value="false" 
                            control={<Radio />} 
                            label={t('disable_progressive_hints', 'Disable progressive hints')} 
                        />
                    </RadioGroup>
                </FormControl>
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
                                        onDelete={loading ? undefined : () => removeIgnoredCategory(lsId, c)}
                                        disabled={loading}
                                        sx={{ cursor: loading ? 'default' : 'pointer' }}
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
                    disabled={loading || description.trim() === profile.self_description}
                >
                    {t('update_description')}
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
