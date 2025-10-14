import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Snackbar,
  Alert,
  Box,
  Typography,
  CircularProgress,
  Checkbox
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ShareIcon from '@mui/icons-material/Share';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { STORAGE_KEYS } from '../../../shared/constants/constants';

export default function PrivateListManager({ open, onClose, languageSetId }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Lists Tab State
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  // Phrases Tab State
  const [phrases, setPhrases] = useState([]);
  const [selectedPhrases, setSelectedPhrases] = useState(new Set());
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [customPhrase, setCustomPhrase] = useState('');
  const [customTranslation, setCustomTranslation] = useState('');
  const [customCategories, setCustomCategories] = useState('');
  
  // Batch Import State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importPreview, setImportPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);

  // List Sharing State
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [listShares, setListShares] = useState([]);

  // Statistics State
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [listStats, setListStats] = useState(null);
  const [userStats, setUserStats] = useState(null);

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch all lists
  const fetchLists = useCallback(async () => {
    if (!languageSetId) return;

    setLoading(true);
    try {
      const response = await axios.get('/api/user/private-lists', {
        params: { language_set_id: languageSetId },
        headers: getAuthHeader()
      });
      setLists(response.data.lists || []);
      
      // Auto-select first list if none selected
      if (!selectedListId && response.data.lists.length > 0) {
        setSelectedListId(response.data.lists[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch lists:', error);
      showNotification(t('privateListManager.errors.fetchListsFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [languageSetId, selectedListId, getAuthHeader, t]);

  // Fetch phrases from selected list
  const fetchPhrases = useCallback(async () => {
    if (!selectedListId) {
      setPhrases([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/user/private-lists/${selectedListId}/phrases`, {
        headers: getAuthHeader()
      });
      setPhrases(response.data.phrases || []);
    } catch (error) {
      console.error('Failed to fetch phrases:', error);
      showNotification(t('privateListManager.errors.fetchPhrasesFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedListId, getAuthHeader, t]);

  // Load data when dialog opens or tab changes
  useEffect(() => {
    if (open) {
      fetchLists();
    }
  }, [open, fetchLists]);

  useEffect(() => {
    if (open && activeTab === 1 && selectedListId) {
      fetchPhrases();
    }
  }, [open, activeTab, selectedListId, fetchPhrases]);

  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // ===== Lists Tab Functions =====

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      showNotification(t('privateListManager.validation.listNameRequired'), 'error');
      return;
    }

    if (newListName.length > 100) {
      showNotification(t('privateListManager.validation.listNameTooLong'), 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/user/private-lists', {
        list_name: newListName.trim(),
        language_set_id: languageSetId
      }, {
        headers: getAuthHeader()
      });

      showNotification(t('privateListManager.success.listCreated'), 'success');
      setNewListName('');
      setShowCreateDialog(false);
      await fetchLists();
    } catch (error) {
      console.error('Failed to create list:', error);
      const message = error.response?.data?.detail || t('privateListManager.errors.createListFailed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (list) => {
    setEditingListId(list.id);
    setEditingListName(list.list_name);
  };

  const handleCancelEdit = () => {
    setEditingListId(null);
    setEditingListName('');
  };

  const handleSaveEdit = async (listId) => {
    if (!editingListName.trim()) {
      showNotification(t('privateListManager.validation.listNameRequired'), 'error');
      return;
    }

    if (editingListName.length > 100) {
      showNotification(t('privateListManager.validation.listNameTooLong'), 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`/api/user/private-lists/${listId}`, {
        list_name: editingListName.trim()
      }, {
        headers: getAuthHeader()
      });

      showNotification(t('privateListManager.success.listRenamed'), 'success');
      setEditingListId(null);
      setEditingListName('');
      await fetchLists();
    } catch (error) {
      console.error('Failed to rename list:', error);
      const message = error.response?.data?.detail || t('privateListManager.errors.renameListFailed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = (list) => {
    setDeleteConfirmation(list);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    setLoading(true);
    try {
      await axios.delete(`/api/user/private-lists/${deleteConfirmation.id}`, {
        headers: getAuthHeader()
      });

      showNotification(t('privateListManager.success.listDeleted'), 'success');
      setDeleteConfirmation(null);
      
      // Clear selection if deleted list was selected
      if (selectedListId === deleteConfirmation.id) {
        setSelectedListId(null);
      }
      
      await fetchLists();
    } catch (error) {
      console.error('Failed to delete list:', error);
      const message = error.response?.data?.detail || t('privateListManager.errors.deleteListFailed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== Phrases Tab Functions =====

  const handleAddCustomPhrase = async () => {
    if (!customPhrase.trim() || !customTranslation.trim()) {
      showNotification(t('privateListManager.validation.phraseAndTranslationRequired'), 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/api/user/private-lists/${selectedListId}/phrases`, {
        custom_phrase: customPhrase.trim(),
        custom_translation: customTranslation.trim(),
        custom_categories: customCategories.trim() || null
      }, {
        headers: getAuthHeader()
      });

      showNotification(t('privateListManager.success.phraseAdded'), 'success');
      setCustomPhrase('');
      setCustomTranslation('');
      setCustomCategories('');
      setShowAddCustomDialog(false);
      await fetchPhrases();
      await fetchLists(); // Update phrase count
    } catch (error) {
      console.error('Failed to add custom phrase:', error);
      const message = error.response?.data?.detail || t('privateListManager.errors.addPhraseFailed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhrase = async (phraseEntryId) => {
    setLoading(true);
    try {
      await axios.delete(`/api/user/private-lists/${selectedListId}/phrases/${phraseEntryId}`, {
        headers: getAuthHeader()
      });

      showNotification(t('privateListManager.success.phraseRemoved'), 'success');
      await fetchPhrases();
      await fetchLists(); // Update phrase count
    } catch (error) {
      console.error('Failed to remove phrase:', error);
      const message = error.response?.data?.detail || t('privateListManager.errors.removePhraseFailed');
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== Batch Import Functions =====

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportFile(file);
    // eslint-disable-next-line no-undef
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let parsedData = [];

        if (file.name.endsWith('.json')) {
          parsedData = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          // Simple CSV parser
          const lines = content.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          parsedData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((header, idx) => {
              obj[header] = values[idx] || '';
            });
            return obj;
          });
        }

        if (!Array.isArray(parsedData)) {
          throw new Error('Invalid file format');
        }

        setImportData(parsedData);
        setImportPreview(parsedData.slice(0, 10)); // Show first 10 for preview
        showNotification(`Loaded ${parsedData.length} phrases for import`, 'success');
      } catch (error) {
        showNotification('Failed to parse file. Ensure correct JSON/CSV format.', 'error');
        console.error('Parse error:', error);
      }
    };

    reader.readAsText(file);
  };

  const handleBatchImport = async () => {
    if (!importData || importData.length === 0) {
      showNotification('No data to import', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `/api/user/private-lists/${selectedListId}/phrases/batch`,
        importData,
        { headers: getAuthHeader() }
      );

      setImportResult(response.data);
      showNotification(
        `Imported ${response.data.added_count} phrases (${response.data.error_count} errors)`,
        response.data.error_count > 0 ? 'warning' : 'success'
      );

      if (response.data.added_count > 0) {
        await fetchPhrases();
        await fetchLists();
      }
    } catch (error) {
      console.error('Batch import failed:', error);
      showNotification('Batch import failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseImportDialog = () => {
    setShowImportDialog(false);
    setImportFile(null);
    setImportData([]);
    setImportPreview([]);
    setImportResult(null);
  };

  // ===== List Sharing Functions =====

  const fetchListShares = async () => {
    if (!selectedListId) return;

    try {
      const response = await axios.get(`/api/user/private-lists/${selectedListId}/shares`, {
        headers: getAuthHeader()
      });
      setListShares(response.data.shares || []);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    }
  };

  const handleShareList = async () => {
    if (!shareUsername.trim()) {
      showNotification('Please enter a username', 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `/api/user/private-lists/${selectedListId}/share`,
        {
          shared_with_username: shareUsername.trim(),
          permission: sharePermission
        },
        { headers: getAuthHeader() }
      );

      showNotification(`List shared with ${shareUsername}`, 'success');
      setShareUsername('');
      await fetchListShares();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to share list';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (sharedWithUserId) => {
    setLoading(true);
    try {
      await axios.delete(
        `/api/user/private-lists/${selectedListId}/share/${sharedWithUserId}`,
        { headers: getAuthHeader() }
      );

      showNotification('Sharing removed', 'success');
      await fetchListShares();
    } catch {
      showNotification('Failed to remove sharing', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== Statistics Functions =====

  const fetchListStatistics = async () => {
    if (!selectedListId) return;

    try {
      const response = await axios.get(`/api/user/private-lists/${selectedListId}/statistics`, {
        headers: getAuthHeader()
      });
      setListStats(response.data);
    } catch (error) {
      console.error('Failed to fetch list statistics:', error);
    }
  };

  const fetchUserStatistics = async () => {
    try {
      const response = await axios.get('/api/user/lists/statistics', {
        headers: getAuthHeader()
      });
      setUserStats(response.data);
    } catch (error) {
      console.error('Failed to fetch user statistics:', error);
    }
  };

  const handleTogglePhraseSelection = (phraseEntryId) => {
    setSelectedPhrases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phraseEntryId)) {
        newSet.delete(phraseEntryId);
      } else {
        newSet.add(phraseEntryId);
      }
      return newSet;
    });
  };

  const handleSelectAllPhrases = () => {
    if (selectedPhrases.size === phrases.length) {
      setSelectedPhrases(new Set());
    } else {
      setSelectedPhrases(new Set(phrases.map(p => p.id)));
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedPhrases.size === 0) {
      showNotification(t('privateListManager.validation.selectPhrasesToRemove'), 'error');
      return;
    }

    setLoading(true);
    try {
      // Delete phrases sequentially
      for (const phraseEntryId of selectedPhrases) {
        await axios.delete(`/api/user/private-lists/${selectedListId}/phrases/${phraseEntryId}`, {
          headers: getAuthHeader()
        });
      }

      showNotification(t('privateListManager.success.phrasesRemoved', { count: selectedPhrases.size }), 'success');
      setSelectedPhrases(new Set());
      await fetchPhrases();
      await fetchLists(); // Update phrase count
    } catch (error) {
      console.error('Failed to remove phrases:', error);
      showNotification(t('privateListManager.errors.removeSelectedFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== Render Functions =====

  const renderListsTab = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{t('privateListManager.lists.title')}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateDialog(true)}
            disabled={loading}
          >
            {t('privateListManager.lists.createNew')}
          </Button>
        </Box>

        {loading && lists.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : lists.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
            {t('privateListManager.lists.noLists')}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('privateListManager.lists.listName')}</TableCell>
                <TableCell align="center">{t('privateListManager.lists.phraseCount')}</TableCell>
                <TableCell align="right">{t('privateListManager.lists.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lists.map((list) => (
                <TableRow
                  key={list.id}
                  selected={list.id === selectedListId}
                  hover
                  onClick={() => setSelectedListId(list.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    {editingListId === list.id ? (
                      <TextField
                        value={editingListName}
                        onChange={(e) => setEditingListName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(list.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        fullWidth
                        autoFocus
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {list.list_name}
                        {list.is_system && (
                          <Chip label={t('privateListManager.lists.systemList')} size="small" color="primary" />
                        )}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="center">{list.phrase_count || 0}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {editingListId === list.id ? (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleSaveEdit(list.id)}
                          disabled={loading}
                          color="primary"
                        >
                          <SaveIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancelEdit}
                          disabled={loading}
                        >
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleStartEdit(list)}
                          disabled={list.is_system || loading}
                          title={list.is_system ? t('privateListManager.lists.cannotRenameSystem') : ''}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteList(list)}
                          disabled={list.is_system || loading}
                          color="error"
                          title={list.is_system ? t('privateListManager.lists.cannotDeleteSystem') : ''}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create List Dialog */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
          <DialogTitle>{t('privateListManager.lists.createNew')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t('privateListManager.lists.listName')}
              fullWidth
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateList();
              }}
              helperText={t('privateListManager.validation.maxLength', { max: 100 })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateDialog(false)} disabled={loading}>
              {t('privateListManager.buttons.cancel')}
            </Button>
            <Button onClick={handleCreateList} variant="contained" disabled={loading}>
              {t('privateListManager.buttons.create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)}>
          <DialogTitle>{t('privateListManager.lists.confirmDelete')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('privateListManager.lists.deleteWarning', { name: deleteConfirmation?.list_name })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmation(null)} disabled={loading}>
              {t('privateListManager.buttons.cancel')}
            </Button>
            <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={loading}>
              {t('privateListManager.buttons.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  const renderPhrasesTab = () => {
    const selectedList = lists.find(l => l.id === selectedListId);

    if (!selectedListId) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('privateListManager.phrases.selectListFirst')}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t('privateListManager.phrases.title', { listName: selectedList?.list_name || '' })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddCustomDialog(true)}
              disabled={loading}
              size="small"
            >
              {t('privateListManager.phrases.addCustom')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => setShowImportDialog(true)}
              disabled={loading}
              size="small"
            >
              Import CSV/JSON
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={() => {
                fetchListShares();
                setShowShareDialog(true);
              }}
              disabled={loading}
              size="small"
            >
              Share List
            </Button>
            <Button
              variant="outlined"
              startIcon={<BarChartIcon />}
              onClick={() => {
                fetchListStatistics();
                setShowStatsDialog(true);
              }}
              disabled={loading}
              size="small"
            >
              Statistics
            </Button>
            {selectedPhrases.size > 0 && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleRemoveSelected}
                disabled={loading}
                size="small"
              >
                {t('privateListManager.phrases.removeSelected', { count: selectedPhrases.size })}
              </Button>
            )}
          </Box>
        </Box>

        {loading && phrases.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : phrases.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 4 }}>
            {t('privateListManager.phrases.noPhrases')}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedPhrases.size === phrases.length && phrases.length > 0}
                    indeterminate={selectedPhrases.size > 0 && selectedPhrases.size < phrases.length}
                    onChange={handleSelectAllPhrases}
                  />
                </TableCell>
                <TableCell>{t('privateListManager.phrases.phrase')}</TableCell>
                <TableCell>{t('privateListManager.phrases.translation')}</TableCell>
                <TableCell>{t('privateListManager.phrases.categories')}</TableCell>
                <TableCell align="center">{t('privateListManager.phrases.type')}</TableCell>
                <TableCell align="right">{t('privateListManager.phrases.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {phrases.map((phrase) => (
                <TableRow key={phrase.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPhrases.has(phrase.id)}
                      onChange={() => handleTogglePhraseSelection(phrase.id)}
                    />
                  </TableCell>
                  <TableCell>{phrase.phrase}</TableCell>
                  <TableCell>{phrase.translation}</TableCell>
                  <TableCell>{phrase.categories || '-'}</TableCell>
                  <TableCell align="center">
                    {phrase.is_custom ? (
                      <Chip label={t('privateListManager.phrases.custom')} size="small" color="secondary" />
                    ) : (
                      <Chip label={t('privateListManager.phrases.public')} size="small" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleRemovePhrase(phrase.id)}
                      color="error"
                      disabled={loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Add Custom Phrase Dialog */}
        <Dialog open={showAddCustomDialog} onClose={() => setShowAddCustomDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('privateListManager.phrases.addCustom')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={t('privateListManager.phrases.phrase')}
              fullWidth
              value={customPhrase}
              onChange={(e) => setCustomPhrase(e.target.value)}
              required
            />
            <TextField
              margin="dense"
              label={t('privateListManager.phrases.translation')}
              fullWidth
              value={customTranslation}
              onChange={(e) => setCustomTranslation(e.target.value)}
              required
            />
            <TextField
              margin="dense"
              label={t('privateListManager.phrases.categories')}
              fullWidth
              value={customCategories}
              onChange={(e) => setCustomCategories(e.target.value)}
              helperText={t('privateListManager.phrases.categoriesOptional')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAddCustomDialog(false)} disabled={loading}>
              {t('privateListManager.buttons.cancel')}
            </Button>
            <Button onClick={handleAddCustomPhrase} variant="contained" disabled={loading}>
              {t('privateListManager.buttons.add')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>{t('privateListManager.title')}</DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label={t('privateListManager.tabs.lists')} />
            <Tab label={t('privateListManager.tabs.phrases')} />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {activeTab === 0 && renderListsTab()}
            {activeTab === 1 && renderPhrasesTab()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('privateListManager.buttons.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification?.severity} sx={{ width: '100%' }}>
          {notification?.message}
        </Alert>
      </Snackbar>

      {/* Batch Import Dialog */}
      <Dialog open={showImportDialog} onClose={handleCloseImportDialog} maxWidth="md" fullWidth>
        <DialogTitle>Import Phrases from CSV/JSON</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upload a CSV or JSON file with phrases. Format: phrase, translation, categories (optional)
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadFileIcon />}
              sx={{ mt: 1 }}
            >
              Select File
              <input
                type="file"
                hidden
                accept=".csv,.json"
                onChange={handleFileSelect}
              />
            </Button>
            {importFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected: {importFile.name} ({importData.length} phrases)
              </Typography>
            )}
          </Box>

          {importPreview.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Preview (first 10 rows):
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Phrase</TableCell>
                    <TableCell>Translation</TableCell>
                    <TableCell>Categories</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importPreview.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.phrase}</TableCell>
                      <TableCell>{item.translation}</TableCell>
                      <TableCell>{item.categories || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {importResult && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={importResult.error_count > 0 ? 'warning' : 'success'}>
                Imported: {importResult.added_count} | Errors: {importResult.error_count}
              </Alert>
              {importResult.errors && importResult.errors.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="error">
                    First {importResult.errors.length} errors:
                  </Typography>
                  {importResult.errors.map((err, idx) => (
                    <Typography key={idx} variant="caption" display="block">
                      Row {err.index + 1}: {err.error}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Close</Button>
          <Button 
            onClick={handleBatchImport} 
            variant="contained" 
            disabled={loading || importData.length === 0}
          >
            Import {importData.length} Phrases
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share List Dialog */}
      <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share List</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Username"
              value={shareUsername}
              onChange={(e) => setShareUsername(e.target.value)}
              margin="dense"
            />
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Chip
                label="Read Only"
                color={sharePermission === 'read' ? 'primary' : 'default'}
                onClick={() => setSharePermission('read')}
                clickable
              />
              <Chip
                label="Read & Write"
                color={sharePermission === 'write' ? 'primary' : 'default'}
                onClick={() => setSharePermission('write')}
                clickable
              />
            </Box>
            <Button
              variant="contained"
              onClick={handleShareList}
              disabled={loading || !shareUsername.trim()}
              sx={{ mt: 2 }}
              fullWidth
            >
              Share
            </Button>
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Currently shared with:
          </Typography>
          {listShares.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Not shared with anyone
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Permission</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listShares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell>{share.username}</TableCell>
                    <TableCell>
                      <Chip
                        label={share.permission}
                        size="small"
                        color={share.permission === 'write' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleUnshare(share.shared_with_user_id)}
                        disabled={loading}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShareDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Statistics Dialog */}
      <Dialog open={showStatsDialog} onClose={() => setShowStatsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>List Statistics</DialogTitle>
        <DialogContent>
          {listStats ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                {listStats.list_name}
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Total Phrases</TableCell>
                    <TableCell align="right"><strong>{listStats.total_phrases}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Custom Phrases</TableCell>
                    <TableCell align="right">{listStats.custom_phrases}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Public Phrases</TableCell>
                    <TableCell align="right">{listStats.public_phrases}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">
                      {listStats.created_at ? new Date(listStats.created_at).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align="right">
                      {listStats.updated_at ? new Date(listStats.updated_at).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          ) : (
            <CircularProgress />
          )}

          {userStats && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Your Overall Statistics
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Total Lists</TableCell>
                    <TableCell align="right"><strong>{userStats.total_lists}</strong></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Phrases</TableCell>
                    <TableCell align="right"><strong>{userStats.total_phrases}</strong></TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {userStats.most_used_lists && userStats.most_used_lists.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Most Used Lists:
                  </Typography>
                  {userStats.most_used_lists.map((list) => (
                    <Box key={list.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2">{list.list_name}</Typography>
                      <Chip label={`${list.phrase_count} phrases`} size="small" />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            fetchUserStatistics();
          }} disabled={loading}>
            Refresh Stats
          </Button>
          <Button onClick={() => setShowStatsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
