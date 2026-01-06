import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardActions,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography,
    Alert,
} from '@mui/material';
import {
    Add as AddIcon,
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    People as PeopleIcon,
    Refresh as RefreshIcon,
    Schedule as ScheduleIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTeacherApi } from './useTeacherApi';
import CreatePhraseSetDialog from './CreatePhraseSetDialog';
import EditPhraseSetDialog from './EditPhraseSetDialog';
import SessionListDialog from './SessionListDialog';
import PreviewDialog from './PreviewDialog';
import GroupsView from './GroupsView';
import { Tabs, Tab } from '@mui/material';

/**
 * Teacher Dashboard Component
 * Provides UI for teachers to manage their phrase sets
 */
function TeacherDashboard({ token, languageSets, currentLanguageSetId }) {
    // State
    const [phraseSets, setPhraseSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [selectedSet, setSelectedSet] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [setToDelete, setSetToDelete] = useState(null);
    const [currentTab, setCurrentTab] = useState(0);

    const { t } = useTranslation();
    // API hook
    const api = useTeacherApi({ token, setError });

    // Load phrase sets
    const loadPhraseSets = useCallback(async () => {
        setLoading(true);
        try {
            const result = await api.fetchPhraseSets();
            setPhraseSets(result.sets || []);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPhraseSets();
    }, []);

    // Handle copy link
    const handleCopyLink = useCallback(async (hotlinkToken) => {
        try {
            await api.copyLinkToClipboard(hotlinkToken);
            setSnackbar({ open: true, message: t('teacher.dashboard.link_copied', 'Link copied to clipboard!'), severity: 'success' });
        } catch {
            setSnackbar({ open: true, message: t('teacher.dashboard.link_failed', 'Failed to copy link'), severity: 'error' });
        }
    }, [api, t]);

    // Handle delete
    const handleDeleteClick = useCallback((phraseSet) => {
        setSetToDelete(phraseSet);
        setDeleteConfirmOpen(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!setToDelete) return;
        try {
            await api.deletePhraseSet(setToDelete.id);
            setSnackbar({ open: true, message: t('teacher.dashboard.delete_success', 'Phrase set deleted'), severity: 'success' });
            setPhraseSets(prev => prev.filter(s => s.id !== setToDelete.id));
        } catch (err) {
            setSnackbar({ open: true, message: err.message, severity: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setSetToDelete(null);
        }
    }, [setToDelete, api, t]);

    // Handle view sessions
    const handleViewSessions = useCallback((phraseSet) => {
        setSelectedSet(phraseSet);
        setSessionsDialogOpen(true);
    }, []);

    // Handle preview
    const handlePreview = useCallback((phraseSet) => {
        setSelectedSet(phraseSet);
        setPreviewDialogOpen(true);
    }, []);

    // Handle set created
    const handleSetCreated = useCallback((newSet) => {
        setPhraseSets(prev => [newSet, ...prev]);
        setSnackbar({ open: true, message: t('teacher.dashboard.create_success', 'Phrase set created!'), severity: 'success' });
    }, [t]);

    // Handle set updated
    const handleSetUpdated = useCallback((updatedSet) => {
        setPhraseSets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));
        setSnackbar({ open: true, message: t('teacher.dashboard.update_success', 'Phrase set updated!'), severity: 'success' });
    }, [t]);

    // Handle edit
    const handleEdit = useCallback((phraseSet) => {
        setSelectedSet(phraseSet);
        setEditDialogOpen(true);
    }, []);

    // Get time remaining
    const getTimeRemaining = (autoDeleteAt) => {
        if (!autoDeleteAt) return null;
        const now = new Date();
        const deleteDate = new Date(autoDeleteAt);
        const diffDays = Math.ceil((deleteDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return t('teacher.dashboard.expired', 'Expired');
        if (diffDays === 0) return t('teacher.dashboard.today', 'Today');
        if (diffDays === 1) return t('teacher.dashboard.one_day', '1 day');
        return t('teacher.dashboard.days', { count: diffDays, defaultValue: '{{count}} days' });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h5" component="h1">
                    {t('teacher.dashboard.title', 'Teacher Mode')}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadPhraseSets}
                        variant="outlined"
                        size="small"
                    >
                        {t('teacher.dashboard.refresh', 'Refresh')}
                    </Button>
                    <Button
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                        variant="contained"
                        color="primary"
                    >
                        {t('teacher.dashboard.create_puzzle', 'Create Puzzle')}
                    </Button>
                </Stack>
            </Stack>

            <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label={t('teacher.dashboard.tab_puzzles', 'Puzzles')} />
                <Tab label={t('teacher.groups.title', 'Groups')} />
            </Tabs>

            {currentTab === 1 ? (
                <GroupsView token={token} />
            ) : (
                <Box>
                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {/* Empty State */}
                    {phraseSets.length === 0 && !error && (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                {t('teacher.dashboard.no_puzzles', 'No puzzles yet')}
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                {t('teacher.dashboard.no_puzzles_sub', 'Create your first puzzle to share with students')}
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => setCreateDialogOpen(true)}
                                variant="contained"
                            >
                                {t('teacher.dashboard.create_puzzle', 'Create Puzzle')}
                            </Button>
                        </Paper>
                    )}

                    {/* Phrase Set Cards */}
                    <Stack spacing={2}>
                        {phraseSets.map((set) => (
                            <Card key={set.id} variant="outlined">
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" component="h2">
                                                {set.name}
                                            </Typography>
                                            {set.description && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {set.description}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                            <Chip
                                                size="small"
                                                label={`${set.phrase_count || 0} ${t('phrases', 'phrases')}`}
                                                color="primary"
                                                variant="outlined"
                                            />
                                            <Chip
                                                size="small"
                                                icon={<PeopleIcon />}
                                                label={`${set.session_count || 0} ${t('plays', 'plays')}`}
                                            />
                                            {set.access_type === 'private' && (
                                                <Chip size="small" label={t('teacher.create.access_private', 'Private').split(' ')[0]} color="warning" />
                                            )}
                                        </Stack>
                                    </Stack>

                                    <Divider sx={{ my: 1.5 }} />

                                    <Stack direction="row" spacing={3} flexWrap="wrap">
                                        {/* Shareable Link */}
                                        <Box sx={{ flex: 1, minWidth: 250 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('teacher.dashboard.shareable_link', 'Shareable Link')}
                                            </Typography>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <TextField
                                                    size="small"
                                                    value={api.getShareableLink(set.current_hotlink_token)}
                                                    InputProps={{
                                                        readOnly: true,
                                                        sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
                                                    }}
                                                    fullWidth
                                                />
                                                <Tooltip title={t('teacher.dashboard.copy_link', 'Copy link')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyLink(set.current_hotlink_token)}
                                                    >
                                                        <CopyIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Box>

                                        {/* Stats */}
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('teacher.dashboard.completed', 'Completed')}
                                            </Typography>
                                            <Typography variant="body2">
                                                {set.completed_count || 0} / {set.session_count || 0}
                                            </Typography>
                                        </Box>

                                        {/* Expires */}
                                        {set.auto_delete_at && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('teacher.dashboard.auto_delete_in', 'Auto-delete in')}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color={getTimeRemaining(set.auto_delete_at) === 'Expired' ? 'error' : 'text.primary'}
                                                >
                                                    <ScheduleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                                    {getTimeRemaining(set.auto_delete_at)}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>
                                </CardContent>

                                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                                    <Button
                                        size="small"
                                        startIcon={<ViewIcon />}
                                        onClick={() => handlePreview(set)}
                                    >
                                        {t('teacher.dashboard.preview', 'Preview')}
                                    </Button>
                                    <Button
                                        size="small"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleEdit(set)}
                                    >
                                        {t('edit', 'Edit')}
                                    </Button>
                                    <Button
                                        size="small"
                                        startIcon={<PeopleIcon />}
                                        onClick={() => handleViewSessions(set)}
                                    >
                                        {t('teacher.dashboard.sessions', 'Sessions')}
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeleteClick(set)}
                                    >
                                        {t('teacher.dashboard.delete', 'Delete')}
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Stack>

                    {/* Create Dialog */}
                    <CreatePhraseSetDialog
                        open={createDialogOpen}
                        onClose={() => setCreateDialogOpen(false)}
                        onCreated={handleSetCreated}
                        token={token}
                        languageSets={languageSets}
                        currentLanguageSetId={currentLanguageSetId}
                    />

                    {/* Edit Dialog */}
                    <EditPhraseSetDialog
                        open={editDialogOpen}
                        onClose={() => setEditDialogOpen(false)}
                        onUpdated={handleSetUpdated}
                        token={token}
                        languageSets={languageSets}
                        phraseSet={selectedSet}
                    />

                    {/* Sessions Dialog */}
                    <SessionListDialog
                        open={sessionsDialogOpen}
                        onClose={() => setSessionsDialogOpen(false)}
                        phraseSet={selectedSet}
                        token={token}
                    />

                    {/* Preview Dialog */}
                    <PreviewDialog
                        open={previewDialogOpen}
                        onClose={() => setPreviewDialogOpen(false)}
                        phraseSet={selectedSet}
                        token={token}
                    />

                    {/* Delete Confirmation */}
                    <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                        <DialogTitle>{t('teacher.dashboard.delete_confirm_title', 'Delete Puzzle?')}</DialogTitle>
                        <DialogContent>
                            <Typography>
                                {t('teacher.dashboard.delete_confirm_message', { name: setToDelete?.name || '' })}
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setDeleteConfirmOpen(false)}>{t('cancel', 'Cancel')}</Button>
                            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                                {t('teacher.dashboard.delete', 'Delete')}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Snackbar */}
                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={4000}
                        onClose={() => setSnackbar({ ...snackbar, open: false })}
                    >
                        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                            {snackbar.message}
                        </Alert>
                    </Snackbar>
                </Box>
            )}
        </Box>
    );
}

export default TeacherDashboard;
