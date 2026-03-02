import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  useTheme,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAdminApi } from '../AdminPanel/useAdminApi';
import axios from 'axios';

// Imported Tab Components
import OverviewTab from './Tabs/OverviewTab';
import LanguageSetsTab from './Tabs/LanguageSetsTab';
import UserStatisticsTab from './Tabs/UserStatisticsTab';
import HighScoresTab from './Tabs/HighScoresTab';

const StatisticsDashboard = ({ token, setError: onError, currentUser }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Create a minimal configuration for useAdminApi, only providing what's needed
  const { getWithAuth } = useAdminApi({
    token,
    setRows: () => { }, // Not used in statistics dashboard
    setTotalRows: () => { }, // Not used in statistics dashboard
    setDashboard: () => { }, // Not used in statistics dashboard
    setError: onError,
    setToken: () => { }, // Not used in statistics dashboard
    setIsLogged: () => { } // Not used in statistics dashboard
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedLanguageSet, setSelectedLanguageSet] = useState('');

  // Data states
  const [overview, setOverview] = useState(null);
  const [languageSets, setLanguageSets] = useState([]);
  const [languageSetStats, setLanguageSetStats] = useState([]);
  const [userStatistics, setUserStatistics] = useState([]);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [highScores, setHighScores] = useState([]);

  // High scores filters
  const [highScoresLanguageSet, setHighScoresLanguageSet] = useState('');
  const [highScoresCategory, setHighScoresCategory] = useState('');
  const [highScoresDifficulty, setHighScoresDifficulty] = useState('');
  const [highScoresGameType, setHighScoresGameType] = useState('');
  const [highScoresLimit, setHighScoresLimit] = useState(50);

  // Root admin settings states
  const [statisticsEnabled, setStatisticsEnabled] = useState(true);
  const [clearStatsDialogOpen, setClearStatsDialogOpen] = useState(false);
  const [toggleStatsDialogOpen, setToggleStatsDialogOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewData, languageSetsData, languageSetStatsData] = await Promise.all([
        getWithAuth('/admin/statistics/overview'),
        getWithAuth('/admin/language-sets'),
        getWithAuth('/admin/statistics/by-language-set')
      ]);

      setOverview(overviewData);
      setLanguageSets(languageSetsData);
      setLanguageSetStats(languageSetStatsData);

      // Load user statistics for selected language set
      await loadUserStatistics();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStatistics = async (langSetId = null) => {
    try {
      const params = langSetId ? `?language_set_id=${langSetId}` : '';
      const data = await getWithAuth(`/admin/statistics/users${params}`);
      setUserStatistics(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadHighScores = async (langSetId = null, category = null, difficulty = null, limit = 50, gameType = null) => {
    try {
      const params = new URLSearchParams();
      if (langSetId) params.append('language_set_id', langSetId);
      if (category) params.append('category', category);
      if (difficulty) params.append('difficulty', difficulty);
      if (gameType) params.append('game_type', gameType);
      if (limit) params.append('limit', limit);

      const queryString = params.toString();
      const data = await getWithAuth(`/admin/statistics/leaderboard${queryString ? `?${queryString}` : ''}`);
      setHighScores(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadUserDetail = async (userId) => {
    try {
      const params = selectedLanguageSet ? `?language_set_id=${selectedLanguageSet}` : '';
      const data = await getWithAuth(`/admin/statistics/user/${userId}${params}`);
      setSelectedUserDetail(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLanguageSetChange = async (event) => {
    const value = event.target.value;
    setSelectedLanguageSet(value);
    await loadUserStatistics(value || null);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Load high scores when switching to high scores tab
    if (newValue === 3) {
      loadHighScores(
        highScoresLanguageSet || null,
        highScoresCategory || null,
        highScoresDifficulty || null,
        highScoresLimit,
        highScoresGameType || null
      );
    }
  };

  const handleHighScoresFilterChange = async (filterName, value) => {
    // Update local state based on filter name
    let newLangSet = highScoresLanguageSet;
    let newCategory = highScoresCategory;
    let newDifficulty = highScoresDifficulty;
    let newLimit = highScoresLimit;
    let newGameType = highScoresGameType;

    switch (filterName) {
      case 'languageSet':
        setHighScoresLanguageSet(value);
        newLangSet = value;
        break;
      case 'category':
        setHighScoresCategory(value);
        newCategory = value;
        break;
      case 'difficulty':
        setHighScoresDifficulty(value);
        newDifficulty = value;
        break;
      case 'gameType':
        setHighScoresGameType(value);
        newGameType = value;
        break;
      case 'limit':
        setHighScoresLimit(value);
        newLimit = value;
        break;
      default:
        break;
    }

    // Debounce/Delay slightly if needed, or just load immediately
    // For dropdowns, immediate load is usually fine
    await loadHighScores(
      newLangSet || null,
      newCategory || null,
      newDifficulty || null,
      newLimit,
      newGameType || null
    );
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

  // Root admin settings functions
  const loadStatisticsSettings = async () => {
    if (currentUser?.role !== 'root_admin') return;

    try {
      const response = await getWithAuth('/admin/settings/statistics-enabled');
      setStatisticsEnabled(response.enabled);
    } catch (err) {
      console.error('Failed to load statistics settings:', err);
    }
  };

  const handleToggleStatistics = async () => {
    if (currentUser?.role !== 'root_admin') return;

    setSettingsLoading(true);
    try {
      await axios.post('/admin/settings/statistics-enabled',
        { enabled: !statisticsEnabled },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setStatisticsEnabled(!statisticsEnabled);
      setToggleStatsDialogOpen(false);
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleClearAllStatistics = async () => {
    if (currentUser?.role !== 'root_admin') return;

    setSettingsLoading(true);
    try {
      await axios.delete('/admin/settings/clear-all-statistics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setClearStatsDialogOpen(false);
      // Reload data to show cleared statistics
      await loadData();
    } catch (err) {
      onError(err.response?.data?.detail || err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Load settings when component mounts
  useEffect(() => {
    if (currentUser?.role === 'root_admin') {
      loadStatisticsSettings();
    }
  }, [currentUser]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t('error')}: {error}
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {t('statistics_dashboard')}
      </Typography>

      {/* Root Admin Settings */}
      {currentUser?.role === 'root_admin' && (
        <Card sx={{ mb: 3, bgcolor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5' }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <SettingsIcon sx={{ mr: 1 }} />
              <Typography variant="h6">{t('admin_settings')}</Typography>
            </Box>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={statisticsEnabled}
                      onChange={() => setToggleStatsDialogOpen(true)}
                      disabled={settingsLoading}
                    />
                  }
                  label={t('statistics_tracking_enabled')}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  {t('statistics_tracking_description')}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setClearStatsDialogOpen(true)}
                  disabled={settingsLoading}
                  fullWidth
                >
                  {t('clear_all_statistics')}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('clear_all_statistics_description')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label={t('overview')} />
        <Tab label={t('by_language_set')} />
        <Tab label={t('user_statistics')} />
        <Tab label={t('high_scores')} />
      </Tabs>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <OverviewTab overview={overview} />
      )}

      {/* Language Set Statistics Tab */}
      {activeTab === 1 && (
        <LanguageSetsTab languageSetStats={languageSetStats} />
      )}

      {/* User Statistics Tab */}
      {activeTab === 2 && (
        <UserStatisticsTab
          userStatistics={userStatistics}
          languageSets={languageSets}
          selectedLanguageSet={selectedLanguageSet}
          onLanguageSetChange={handleLanguageSetChange}
          onUserSelect={loadUserDetail}
          selectedUserDetail={selectedUserDetail}
          formatTime={formatTime}
          formatDate={formatDate}
        />
      )}

      {/* High Scores Tab */}
      {activeTab === 3 && (
        <HighScoresTab
          highScores={highScores}
          languageSets={languageSets}
          filters={{
            languageSet: highScoresLanguageSet,
            category: highScoresCategory,
            difficulty: highScoresDifficulty,
            gameType: highScoresGameType,
            limit: highScoresLimit
          }}
          onFilterChange={handleHighScoresFilterChange}
          formatTime={formatTime}
        />
      )}

      {/* Confirmation Dialogs */}
      <Dialog
        open={clearStatsDialogOpen}
        onClose={() => setClearStatsDialogOpen(false)}
      >
        <DialogTitle>{t('confirm_clear_statistics')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('clear_statistics_warning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearStatsDialogOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleClearAllStatistics}
            color="error"
            variant="contained"
            disabled={settingsLoading}
          >
            {settingsLoading ? <CircularProgress size={20} /> : t('clear_all')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={toggleStatsDialogOpen}
        onClose={() => setToggleStatsDialogOpen(false)}
      >
        <DialogTitle>{t('confirm_change_settings')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {statisticsEnabled
              ? t('disable_statistics_warning')
              : t('enable_statistics_confirmation')
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToggleStatsDialogOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleToggleStatistics}
            color="primary"
            variant="contained"
            disabled={settingsLoading}
          >
            {settingsLoading ? <CircularProgress size={20} /> : t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default StatisticsDashboard;
