import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Games as GamesIcon,
  Timer as TimerIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAdminApi } from '../AdminPanel/useAdminApi';
import axios from 'axios';

const StatisticsDashboard = ({ token, setError: onError, currentUser }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  // Create a minimal configuration for useAdminApi, only providing what's needed
  const { getWithAuth } = useAdminApi({
    token,
    setRows: () => {}, // Not used in statistics dashboard
    setTotalRows: () => {}, // Not used in statistics dashboard
    setDashboard: () => {}, // Not used in statistics dashboard
    setError: onError,
    setToken: () => {}, // Not used in statistics dashboard
    setIsLogged: () => {} // Not used in statistics dashboard
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
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom>
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
              <Grid item xs={12} md={6}>
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
              
              <Grid item xs={12} md={6}>
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
      </Tabs>

      {/* Overview Tab */}
      {activeTab === 0 && overview && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <PeopleIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {t('total_users')}
                    </Typography>
                    <Typography variant="h4">
                      {overview.total_users}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <TrendingUpIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {t('active_users_30d')}
                    </Typography>
                    <Typography variant="h4">
                      {overview.active_users_30d}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <GamesIcon color="info" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {t('total_games')}
                    </Typography>
                    <Typography variant="h4">
                      {overview.total_games_completed}/{overview.total_games_started}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <TimerIcon color="warning" sx={{ mr: 2 }} />
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {t('total_time_played')}
                    </Typography>
                    <Typography variant="h4">
                      {overview.total_time_played_hours}h
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Language Set Statistics Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {languageSetStats.map((stat) => (
            <Grid item xs={12} md={6} key={stat.language_set_id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {stat.language_set_display_name}
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        {t('games_completed')}
                      </Typography>
                      <Typography variant="h6">
                        {stat.games_completed}/{stat.games_started}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        {t('unique_players')}
                      </Typography>
                      <Typography variant="h6">
                        {stat.unique_players}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        {t('phrases_found')}
                      </Typography>
                      <Typography variant="h6">
                        {stat.phrases_found}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        {t('time_played')}
                      </Typography>
                      <Typography variant="h6">
                        {stat.time_played_hours}h
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* User Statistics Tab */}
      {activeTab === 2 && (
        <Box>
          <FormControl sx={{ mb: 3, minWidth: 200 }}>
            <InputLabel>{t('filter_by_language_set')}</InputLabel>
            <Select
              value={selectedLanguageSet}
              onChange={handleLanguageSetChange}
              label={t('filter_by_language_set')}
            >
              <MenuItem value="">{t('all_language_sets')}</MenuItem>
              {languageSets.map((langSet) => (
                <MenuItem key={langSet.id} value={langSet.id}>
                  {langSet.display_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('username')}</TableCell>
                  <TableCell align="right">{t('games_completed')}</TableCell>
                  <TableCell align="right">{t('phrases_found')}</TableCell>
                  <TableCell align="right">{t('time_played')}</TableCell>
                  <TableCell align="right">{t('phrases_added')}</TableCell>
                  <TableCell align="right">{t('last_activity')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userStatistics.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: theme.palette.action.hover }
                    }}
                    onClick={() => loadUserDetail(user.id)}
                  >
                    <TableCell component="th" scope="row">
                      {user.username}
                    </TableCell>
                    <TableCell align="right">
                      {user.games_completed}/{user.games_started}
                    </TableCell>
                    <TableCell align="right">
                      {user.total_phrases_found || 0}
                    </TableCell>
                    <TableCell align="right">
                      {formatTime(user.total_time_played_seconds)}
                    </TableCell>
                    <TableCell align="right">
                      {(user.phrases_added || 0) + (user.phrases_edited || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {formatDate(user.last_played)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* User Detail Modal/Expansion */}
          {selectedUserDetail && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('detailed_statistics')} - {selectedUserDetail.user?.username || `User ${selectedUserDetail.statistics.user_id}`}
                </Typography>
                
                {selectedUserDetail.favorite_categories.map((langSetData, index) => (
                  <Accordion key={index}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        {langSetData.language_set_name} - {t('favorite_categories')}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {langSetData.categories.map((cat, catIndex) => (
                          <Chip
                            key={catIndex}
                            icon={<StarIcon />}
                            label={`${cat.category} (${cat.plays_count} ${t('plays')})`}
                            variant="outlined"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>
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
        <DialogTitle>
          {statisticsEnabled ? t('disable_statistics') : t('enable_statistics')}
        </DialogTitle>
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
    </Box>
  );
};

export default StatisticsDashboard;
