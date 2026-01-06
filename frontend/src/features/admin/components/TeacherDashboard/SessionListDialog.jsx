import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Stack,
    Tooltip,
} from '@mui/material';
import {
    CheckCircle as CheckIcon,
    Delete as DeleteIcon,
    FileDownload as DownloadIcon,
    HourglassEmpty as PendingIcon,
    Refresh as RefreshIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTeacherApi } from './useTeacherApi';
import ReviewTranslationsDialog from './ReviewTranslationsDialog';

/**
 * Dialog for viewing sessions for a phrase set
 */
function SessionListDialog({ open, onClose, phraseSet, token }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [reviewDialog, setReviewDialog] = useState({ open: false, session: null });

    const { t } = useTranslation();
    const api = useTeacherApi({ token, setError });

    const loadSessions = useCallback(async () => {
        if (!phraseSet?.id) return;
        setLoading(true);
        try {
            const result = await api.fetchSessions(phraseSet.id);
            setSessions(result.sessions || []);
            setTotal(result.total || 0);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [phraseSet?.id]);

    useEffect(() => {
        if (open && phraseSet) {
            loadSessions();
        }
    }, [open, phraseSet?.id]);

    const handleDeleteSession = async (sessionId) => {
        try {
            await api.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            setTotal(prev => prev - 1);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteAllSessions = async () => {
        if (!phraseSet?.id) return;
        try {
            await api.deleteAllSessions(phraseSet.id);
            setSessions([]);
            setTotal(0);
            setConfirmDeleteAll(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleOpenReview = (session) => {
        setReviewDialog({ open: true, session });
    };

    const handleCloseReview = () => {
        setReviewDialog({ open: false, session: null });
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleExportCSV = () => {
        if (!phraseSet?.id) return;
        // Download CSV via API
        const exportUrl = `/admin/teacher/phrase-sets/${phraseSet.id}/export?format=csv`;
        const link = document.createElement('a');
        link.href = exportUrl;
        link.setAttribute('download', `${phraseSet.name}_sessions.csv`);
        // Add auth header via fetch and blob
        fetch(exportUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                link.href = url;
                link.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(err => setError('Failed to export: ' + err.message));
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
                <DialogTitle>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                            {t('teacher.sessions.title', { name: phraseSet?.name, defaultValue: 'Sessions: {{name}}' })}
                            <Typography variant="body2" color="text.secondary">
                                {t('teacher.sessions.total_sessions', { count: total, defaultValue: '{{count}} total sessions' })}
                            </Typography>
                        </Box>
                        <IconButton onClick={loadSessions} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    {error && (
                        <Typography color="error" sx={{ mb: 2 }}>
                            {error}
                        </Typography>
                    )}

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : sessions.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.secondary">
                                {t('teacher.sessions.no_sessions', 'No sessions yet')}
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('teacher.sessions.player', 'Player')}</TableCell>
                                        <TableCell>{t('teacher.sessions.status', 'Status')}</TableCell>
                                        <TableCell align="center">{t('teacher.sessions.progress', 'Progress')}</TableCell>
                                        <TableCell align="center">{t('teacher.sessions.duration', 'Duration')}</TableCell>
                                        <TableCell>{t('teacher.sessions.started', 'Started')}</TableCell>
                                        <TableCell align="right">{t('teacher.sessions.actions', 'Actions')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sessions.map(session => (
                                        <TableRow key={session.id}>
                                            <TableCell>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="body2">
                                                        {session.nickname}
                                                    </Typography>
                                                    {session.username && (
                                                        <Chip
                                                            size="small"
                                                            label={session.username}
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                {session.is_completed ? (
                                                    <Chip
                                                        size="small"
                                                        icon={<CheckIcon />}
                                                        label={t('teacher.sessions.completed', 'Completed')}
                                                        color="success"
                                                    />
                                                ) : (
                                                    <Chip
                                                        size="small"
                                                        icon={<PendingIcon />}
                                                        label={t('teacher.sessions.in_progress', 'In Progress')}
                                                        color="warning"
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="center">
                                                {session.phrases_found}/{session.total_phrases}
                                            </TableCell>
                                            <TableCell align="center">
                                                {formatDuration(session.duration_seconds)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(session.started_at)}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    {/* Review Button */}
                                                    {session.translation_submissions && session.translation_submissions.length > 0 && (
                                                        <Tooltip title={t('teacher.sessions.review', 'Review Translations')}>
                                                            <IconButton
                                                                size="small"
                                                                color="primary"
                                                                onClick={() => handleOpenReview(session)}
                                                            >
                                                                <ViewIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Delete session">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteSession(session.id)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    {confirmDeleteAll ? (
                        <>
                            <Typography color="error" sx={{ flex: 1 }}>
                                {t('teacher.sessions.delete_all_confirm', { count: total, defaultValue: 'Delete all {{count}} sessions? This cannot be undone.' })}
                            </Typography>
                            <Button onClick={() => setConfirmDeleteAll(false)}>{t('cancel', 'Cancel')}</Button>
                            <Button color="error" variant="contained" onClick={handleDeleteAllSessions}>
                                {t('teacher.sessions.confirm_delete_all_button', 'Confirm Delete All')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                startIcon={<DeleteIcon />}
                                onClick={() => setConfirmDeleteAll(true)}
                                disabled={sessions.length === 0}
                                color="error"
                            >
                                {t('teacher.sessions.delete_all', 'Delete All')}
                            </Button>
                            <Button
                                startIcon={<DownloadIcon />}
                                onClick={handleExportCSV}
                                disabled={sessions.length === 0}
                            >
                                {t('teacher.sessions.export_csv', 'Export CSV')}
                            </Button>
                            <Button onClick={onClose}>{t('teacher.sessions.close', 'Close')}</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>

            <ReviewTranslationsDialog
                open={reviewDialog.open}
                onClose={handleCloseReview}
                session={reviewDialog.session}
            />
        </>
    );
}

export default SessionListDialog;
