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
  const [highScores, setHighScores] = useState([]);

  // High scores filters
  const [highScoresLanguageSet, setHighScoresLanguageSet] = useState('');
  const [highScoresCategory, setHighScoresCategory] = useState('');
  const [highScoresDifficulty, setHighScoresDifficulty] = useState('');
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

  const loadHighScores = async (langSetId = null, category = null, difficulty = null, limit = 50) => {
    try {
      const params = new URLSearchParams();
      if (langSetId) params.append('language_set_id', langSetId);
      if (category) params.append('category', category);
      if (difficulty) params.append('difficulty', difficulty);
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
        highScoresLimit
      );
    }
  };

  const handleHighScoresFilterChange = async () => {
    await loadHighScores(
      highScoresLanguageSet || null,
      highScoresCategory || null,
      highScoresDifficulty || null,
      highScoresLimit
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
        <Tab label={t('high_scores')} />
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
                
                {(selectedUserDetail.favorite_categories || []).map((langSetData, index) => (
                  <Accordion key={index}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        {langSetData.language_set_name} - {t('favorite_categories')}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {(langSetData.categories || []).map((cat, catIndex) => (
                          <Chip
                            key={catIndex}
                            icon={<StarIcon />}
                            label={`${cat.category} (${cat.plays_count} ${t('plays')})`}
                            variant="outlined"
                            color="primary"
                          />
                        ))}
                        {(!langSetData.categories || langSetData.categories.length === 0) && (
                          <Typography variant="body2" color="text.secondary">
                            {t('no_favorite_categories', 'No favorite categories')}
                          </Typography>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* High Scores Tab */}
      {activeTab === 3 && (
        <Box>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t('language_set')}</InputLabel>
                <Select
                  value={highScoresLanguageSet}
                  onChange={(e) => {
                    setHighScoresLanguageSet(e.target.value);
                    setTimeout(handleHighScoresFilterChange, 100);
                  }}
                  label={t('language_set')}
                >
                  <MenuItem value="">{t('all_language_sets')}</MenuItem>
                  {languageSets.map((langSet) => (
                    <MenuItem key={langSet.id} value={langSet.id}>
                      {langSet.display_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t('category')}</InputLabel>
                <Select
                  value={highScoresCategory}
                  onChange={(e) => {
                    setHighScoresCategory(e.target.value);
                    setTimeout(handleHighScoresFilterChange, 100);
                  }}
                  label={t('category')}
                >
                  <MenuItem value="">{t('all_categories')}</MenuItem>
                  {/* Categories would need to be loaded separately or extracted from existing data */}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t('difficulty')}</InputLabel>
                <Select
                  value={highScoresDifficulty}
                  onChange={(e) => {
                    setHighScoresDifficulty(e.target.value);
                    setTimeout(handleHighScoresFilterChange, 100);
                  }}
                  label={t('difficulty')}
                >
                  <MenuItem value="">{t('all_difficulties')}</MenuItem>
                  <MenuItem value="easy">{t('easy')}</MenuItem>
                  <MenuItem value="medium">{t('medium')}</MenuItem>
                  <MenuItem value="hard">{t('hard')}</MenuItem>
                  <MenuItem value="very_hard">{t('very_hard')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t('limit')}</InputLabel>
                <Select
                  value={highScoresLimit}
                  onChange={(e) => {
                    setHighScoresLimit(e.target.value);
                    setTimeout(handleHighScoresFilterChange, 100);
                  }}
                  label={t('limit')}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={200}>200</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* High Scores Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('rank')}</TableCell>
                  <TableCell>{t('player')}</TableCell>
                  <TableCell>{t('score')}</TableCell>
                  <TableCell>{t('category')}</TableCell>
                  <TableCell>{t('difficulty')}</TableCell>
                  <TableCell>{t('completion')}</TableCell>
                  <TableCell>{t('time')}</TableCell>
                  <TableCell>{t('hints_used')}</TableCell>
                  <TableCell>{t('date')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {highScores.map((score, index) => (
                  <TableRow key={`${score.user_id}-${score.created_at}-${index}`}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        {index < 3 && (
                          <StarIcon 
                            sx={{ 
                              mr: 1,
                              color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'
                            }} 
                          />
                        )}
                        #{index + 1}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {score.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {score.final_score?.toLocaleString() || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>{score.category}</TableCell>
                    <TableCell>
                      <Chip 
                        label={score.difficulty} 
                        size="small"
                        color={
                          score.difficulty === 'easy' ? 'success' :
                          score.difficulty === 'medium' ? 'warning' :
                          score.difficulty === 'hard' ? 'error' :
                          'secondary'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {score.phrases_found}/{score.total_phrases}
                      {score.phrases_found === score.total_phrases && (
                        <Chip label={t('perfect')} size="small" color="success" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>{formatTime(score.duration_seconds)}</TableCell>
                    <TableCell>
                      {score.hints_used > 0 ? (
                        <Chip label={score.hints_used} size="small" color="warning" />
                      ) : (
                        <Chip label="0" size="small" color="success" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {score.created_at ? new Date(score.created_at).toLocaleDateString() : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {highScores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {t('no_high_scores')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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
