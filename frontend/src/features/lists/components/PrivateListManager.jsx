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
    </>
  );
}
