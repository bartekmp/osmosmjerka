import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    FormGroup,
    Divider,
    Alert,
    Snackbar,
    Grid,
    Paper
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_ENDPOINTS, STORAGE_KEYS } from '../../../../shared';

const SystemSettings = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        statisticsEnabled: false,
        scoringEnabled: false,
        progressiveHintsEnabled: false
    });
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success'
    });

    // Load current settings on component mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            
            // Load all three settings
            const [statisticsResponse, scoringResponse, hintsResponse] = await Promise.all([
                axios.get(`${API_ENDPOINTS.ADMIN}/settings/statistics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.ADMIN}/settings/scoring`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.ADMIN}/settings/progressive-hints`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            setSettings({
                statisticsEnabled: statisticsResponse.data.enabled,
                scoringEnabled: scoringResponse.data.enabled,
                progressiveHintsEnabled: hintsResponse.data.enabled
            });
        } catch (error) {
            console.error('Failed to load system settings:', error);
            showNotification(t('admin.settings.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (settingType, enabled) => {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token) return;

        try {
            let endpoint;
            switch (settingType) {
                case 'statistics':
                    endpoint = `${API_ENDPOINTS.ADMIN}/settings/statistics`;
                    break;
                case 'scoring':
                    endpoint = `${API_ENDPOINTS.ADMIN}/settings/scoring`;
                    break;
                case 'progressive-hints':
                    endpoint = `${API_ENDPOINTS.ADMIN}/settings/progressive-hints`;
                    break;
                default:
                    throw new Error(`Unknown setting type: ${settingType}`);
            }

            await axios.put(endpoint, { enabled }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Refresh settings from server to ensure consistency
            await loadSettings();

            showNotification(t('admin.settings.updateSuccess'), 'success');
        } catch (error) {
            console.error(`Failed to update ${settingType} setting:`, error);
            showNotification(t('admin.settings.updateError'), 'error');
            
            // Revert the change on error
            loadSettings();
        }
    };

    const showNotification = (message, severity) => {
        setNotification({
            open: true,
            message,
            severity
        });
    };

    const handleCloseNotification = () => {
        setNotification(prev => ({ ...prev, open: false }));
    };

    const handleToggle = (settingType) => (event) => {
        const enabled = event.target.checked;
        updateSetting(settingType, enabled);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={3}>
                <Typography>{t('common.loading')}</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {t('admin.settings.title')}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" paragraph>
                {t('admin.settings.description')}
            </Typography>

            <Grid container spacing={3}>
                {/* Game Features */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            {t('admin.settings.gameFeatures')}
                        </Typography>
                        
                        <FormGroup>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.scoringEnabled}
                                        onChange={handleToggle('scoring')}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body1">
                                            {t('admin.settings.scoring.title')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('admin.settings.scoring.description')}
                                        </Typography>
                                    </Box>
                                }
                            />
                            
                            <Divider sx={{ my: 2 }} />
                            
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.progressiveHintsEnabled}
                                        onChange={handleToggle('progressive-hints')}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body1">
                                            {t('admin.settings.progressiveHints.title')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('admin.settings.progressiveHints.description')}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </FormGroup>
                    </Paper>
                </Grid>

                {/* Data Collection */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            {t('admin.settings.dataCollection')}
                        </Typography>
                        
                        <FormGroup>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.statisticsEnabled}
                                        onChange={handleToggle('statistics')}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body1">
                                            {t('admin.settings.statistics.title')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('admin.settings.statistics.description')}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </FormGroup>
                    </Paper>
                </Grid>
            </Grid>

            <Box mt={3}>
                <Alert severity="info">
                    {t('admin.settings.notice')}
                </Alert>
            </Box>

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert 
                    onClose={handleCloseNotification} 
                    severity={notification.severity}
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SystemSettings;
