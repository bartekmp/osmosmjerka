import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tooltip,
    Pagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useMediaQuery,
    useTheme
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Delete as DeleteIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../../../../shared/constants/constants';

export default function DuplicateManagement({ currentUser, selectedLanguageSetId }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedPhrases, setSelectedPhrases] = useState(new Set());
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [phrasesToDelete, setPhrasesToDelete] = useState([]);
    const [deleting, setDeleting] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Operation results state
    const [operationResult, setOperationResult] = useState(null);

    const loadDuplicates = useCallback(async (page = currentPage, size = pageSize) => {
        if (!selectedLanguageSetId) {
            setDuplicateGroups([]);
            setTotalCount(0);
            setTotalPages(0);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch(
                `${API_ENDPOINTS.ADMIN_DUPLICATES}?language_set_id=${selectedLanguageSetId}&page=${page}&page_size=${size}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle paginated response
            if (data.duplicates) {
                setDuplicateGroups(data.duplicates);
                setTotalCount(data.total_count);
                setTotalPages(data.total_pages);
                setCurrentPage(data.page);
            } else {
                // Fallback for non-paginated response
                setDuplicateGroups(data);
                setTotalCount(data.length);
                setTotalPages(1);
            }
        } catch (err) {
            setError(t('failed_to_load_duplicates', 'Failed to load duplicates: {{error}}', { error: err.message }));
        } finally {
            setLoading(false);
        }
    }, [selectedLanguageSetId, currentPage, pageSize]);

    useEffect(() => {
        loadDuplicates();
    }, [loadDuplicates]);

    const handlePhraseSelect = useCallback((phraseId, checked) => {
        setSelectedPhrases(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(phraseId);
            } else {
                newSet.delete(phraseId);
            }
            return newSet;
        });
    }, []);

    const handleSelectAllInGroup = useCallback((phrases, checked) => {
        setSelectedPhrases(prev => {
            const newSet = new Set(prev);
            phrases.forEach(phrase => {
                if (checked) {
                    newSet.add(phrase.id);
                } else {
                    newSet.delete(phrase.id);
                }
            });
            return newSet;
        });
    }, []);

    const handleKeepOne = useCallback((phrases, keepPhraseId) => {
        const toDelete = phrases.filter(p => p.id !== keepPhraseId);
        setPhrasesToDelete(toDelete);
        setDeleteDialogOpen(true);
    }, []);

    const handleMergeCategories = useCallback(async (phrases, keepPhraseId) => {
        const duplicateIds = phrases.filter(p => p.id !== keepPhraseId).map(p => p.id);

        try {
            const token = localStorage.getItem('adminToken');

            const response = await fetch(
                `/admin/merge-categories?language_set_id=${selectedLanguageSetId}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        keep_phrase_id: keepPhraseId,
                        duplicate_phrase_ids: duplicateIds
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Store the operation result for display
            setOperationResult({
                type: 'merge',
                data: result
            });

            // Show success message
            setError(''); // Clear any previous errors

            // Reload duplicates to reflect changes
            await loadDuplicates();

            // Clear selections
            setSelectedPhrases(new Set());

        } catch (err) {
            console.error('Error merging categories:', err);
            setError(t('merge_categories_failed', 'Failed to merge categories: {{error}}', {
                error: err.message
            }));
        }
    }, [selectedLanguageSetId, loadDuplicates, t]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedPhrases.size === 0) return;

        const allPhrases = duplicateGroups.flatMap(group => group.duplicates);
        const toDelete = allPhrases.filter(phrase => selectedPhrases.has(phrase.id));
        setPhrasesToDelete(toDelete);
        setDeleteDialogOpen(true);
    }, [selectedPhrases, duplicateGroups]);

    const confirmDelete = useCallback(async () => {
        if (!phrasesToDelete.length) return;

        setDeleting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const phraseIds = phrasesToDelete.map(p => p.id);

            const response = await fetch(
                `${API_ENDPOINTS.ADMIN_DUPLICATES}?language_set_id=${selectedLanguageSetId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(phraseIds)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Store the operation result for display
            setOperationResult({
                type: 'delete',
                data: result
            });

            // Clear selections and reload duplicates
            setSelectedPhrases(new Set());
            await loadDuplicates();

            setDeleteDialogOpen(false);
            setPhrasesToDelete([]);
        } catch (err) {
            setError('Failed to delete phrases: ' + err.message);
        } finally {
            setDeleting(false);
        }
    }, [phrasesToDelete, selectedLanguageSetId, loadDuplicates]);

    const handlePageChange = useCallback((event, newPage) => {
        setCurrentPage(newPage);
        loadDuplicates(newPage, pageSize);
    }, [loadDuplicates, pageSize]);

    const handlePageSizeChange = useCallback((event) => {
        const newPageSize = event.target.value;
        setPageSize(newPageSize);
        setCurrentPage(1); // Reset to first page
        loadDuplicates(1, newPageSize);
    }, [loadDuplicates]);

    const formatPreview = useCallback((text, maxLength = 50) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }, []);

    if (!currentUser || currentUser.role !== 'root_admin') {
        return (
            <Alert severity="warning">
                {t('access_denied', 'Access denied. Root admin privileges required.')}
            </Alert>
        );
    }

    if (!selectedLanguageSetId) {
        return (
            <Alert severity="info">
                {t('select_language_set_first', 'Please select a language set first.')}
            </Alert>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                    {t('duplicate_management', 'Duplicate Management')}
                </Typography>
                <Box display="flex" gap={2} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>{t('duplicates_per_page', 'Duplicates per page')}</InputLabel>
                        <Select
                            value={pageSize}
                            label={t('duplicates_per_page', 'Duplicates per page')}
                            onChange={handlePageSizeChange}
                        >
                            <MenuItem value={5}>5</MenuItem>
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={20}>20</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                        </Select>
                    </FormControl>
                    <Tooltip title={t('refresh', 'Refresh')}>
                        <Button
                            onClick={() => loadDuplicates(currentPage, pageSize)}
                            disabled={loading}
                            variant="outlined"
                            size="small"
                        >
                            {loading ? <CircularProgress size={20} /> : (isMobile ? '🔄' : t('refresh', 'Refresh'))}
                        </Button>
                    </Tooltip>
                    <Tooltip title={`${t('delete_selected', 'Delete Selected')} (${selectedPhrases.size})`}>
                        <span>
                            <Button
                                onClick={handleDeleteSelected}
                                disabled={selectedPhrases.size === 0}
                                variant="contained"
                                color="error"
                                startIcon={<DeleteIcon />}
                            >
                                {isMobile ? selectedPhrases.size : `${t('delete_selected', 'Delete Selected')} (${selectedPhrases.size})`}
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {operationResult && (
                <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    onClose={() => setOperationResult(null)}
                >
                    {operationResult.type === 'merge' ? (
                        <Box>
                            <Typography variant="body2" fontWeight="bold">
                                {t('merge_categories_success', 'Categories merged successfully')}
                            </Typography>
                            <Box mt={1}>
                                <Typography variant="body2">
                                    <strong>{t('kept_phrase_info', 'Kept Phrase:')}</strong>
                                    "{operationResult.data.kept_phrase?.phrase}" (ID: {operationResult.data.kept_phrase?.id})
                                </Typography>
                                <Typography variant="body2">
                                    <strong>{t('merged_categories_info', 'Merged Categories:')}</strong>
                                    {operationResult.data.merged_categories}
                                </Typography>
                                {operationResult.data.category_stats && (
                                    <Typography variant="body2" color="text.secondary">
                                        {operationResult.data.category_stats.duplicates_removed > 0 ? (
                                            <>
                                                {t('categories_merged_from', 'Categories merged from {{count}} duplicates', {
                                                    count: operationResult.data.deleted_count
                                                })} - {operationResult.data.category_stats.duplicates_removed} {t('duplicate_categories_removed', 'duplicate categories removed')}
                                            </>
                                        ) : (
                                            <>
                                                {t('categories_merged_from', 'Categories merged from {{count}} duplicates', {
                                                    count: operationResult.data.deleted_count
                                                })} - {t('no_duplicate_categories_found', 'no duplicate categories found')}
                                            </>
                                        )}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ) : operationResult.type === 'delete' ? (
                        <Box>
                            <Typography variant="body2" fontWeight="bold">
                                {t('delete_selected_success', 'Selected phrases deleted successfully')}
                            </Typography>
                            {operationResult.data.remaining_phrases && operationResult.data.remaining_phrases.length > 0 && (
                                <Box mt={1}>
                                    <Typography variant="body2">
                                        <strong>{t('remaining_phrases_info', 'Remaining Phrases:')}</strong>
                                    </Typography>
                                    {operationResult.data.remaining_phrases.map((phrase) => (
                                        <Typography key={phrase.id} variant="body2" sx={{ ml: 2 }}>
                                            • "{phrase.phrase}" - {phrase.categories} (ID: {phrase.id})
                                        </Typography>
                                    ))}
                                    <Typography variant="body2" color="text.secondary">
                                        {t('phrases_remaining_after_deletion', '{{count}} phrases remaining after deletion', {
                                            count: operationResult.data.remaining_phrases.length
                                        })}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : null}
                </Alert>
            )}

            {loading && (
                <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && duplicateGroups.length === 0 && (
                <Alert severity="success">
                    {t('no_duplicates_found', 'No duplicate phrases found in this language set.')}
                </Alert>
            )}

            {!loading && duplicateGroups.length > 0 && (
                <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            {t('duplicates_found', 'Found {{count}} groups of duplicate phrases.', {
                                count: totalCount
                            })} {totalCount > duplicateGroups.length && (
                                <span> {t('showing_page', 'Showing page {{page}} of {{total}}.', {
                                    page: currentPage,
                                    total: totalPages
                                })}</span>
                            )}
                        </Typography>
                    </Alert>

                    {duplicateGroups.map((group, groupIndex) => (
                        <Accordion key={groupIndex} sx={{ mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box display="flex" alignItems="center" width="100%">
                                    <WarningIcon color="warning" sx={{ mr: 1 }} />
                                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                                        "{formatPreview(group.duplicates[0].phrase)}"
                                    </Typography>
                                    <Chip
                                        label={`${group.count} duplicates`}
                                        color="warning"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    />
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Button
                                            size="small"
                                            onClick={() => handleSelectAllInGroup(
                                                group.duplicates,
                                                !group.duplicates.every(p => selectedPhrases.has(p.id))
                                            )}
                                        >
                                            {group.duplicates.every(p => selectedPhrases.has(p.id))
                                                ? t('unselect_all', 'Unselect All')
                                                : t('select_all', 'Select All')
                                            }
                                        </Button>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('duplicate_help', 'Select phrases to delete, or use "Keep One" to keep only the selected phrase.')}
                                        </Typography>
                                    </Box>

                                    <TableContainer component={Paper} elevation={1}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell padding="checkbox">
                                                        {t('select', 'Select')}
                                                    </TableCell>
                                                    <TableCell>{t('phrase', 'Phrase')}</TableCell>
                                                    <TableCell>{t('translation', 'Translation')}</TableCell>
                                                    <TableCell>{t('categories', 'Categories')}</TableCell>
                                                    <TableCell>{t('actions', 'Actions')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {group.duplicates.map((phrase) => (
                                                    <TableRow key={phrase.id} hover>
                                                        <TableCell padding="checkbox">
                                                            <Checkbox
                                                                checked={selectedPhrases.has(phrase.id)}
                                                                onChange={(e) => handlePhraseSelect(phrase.id, e.target.checked)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {phrase.phrase}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {formatPreview(phrase.translation)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {phrase.categories}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box display="flex" gap={1} flexWrap="wrap">
                                                                <Tooltip title={t('keep_this_delete_others', 'Keep this, delete others')}>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="primary"
                                                                        onClick={() => handleKeepOne(group.duplicates, phrase.id)}
                                                                    >
                                                                        {t('keep_one', 'Keep One')}
                                                                    </Button>
                                                                </Tooltip>
                                                                <Tooltip title={t('merge_categories_keep_this', 'Merge all categories and keep this phrase')}>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="secondary"
                                                                        onClick={() => handleMergeCategories(group.duplicates, phrase.id)}
                                                                    >
                                                                        {t('merge_categories', 'Merge Categories')}
                                                                    </Button>
                                                                </Tooltip>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    ))}

                    {totalPages > 1 && (
                        <Box display="flex" justifyContent="center" alignItems="center" mt={3} gap={2}>
                            <Typography variant="body2" color="text.secondary">
                                {t('page', 'Page')} {currentPage} {t('of', 'of')} {totalPages}
                            </Typography>
                            <Pagination
                                count={totalPages}
                                page={currentPage}
                                onChange={handlePageChange}
                                color="primary"
                                showFirstButton
                                showLastButton
                                siblingCount={1}
                                boundaryCount={1}
                            />
                        </Box>
                    )}
                </Box>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>
                    {t('confirm_delete', 'Confirm Delete')}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {t('delete_phrases_confirmation', 'Are you sure you want to delete {{count}} phrase(s)?', {
                            count: phrasesToDelete.length
                        })}
                    </Typography>
                    <Box mt={2}>
                        {phrasesToDelete.map((phrase) => (
                            <Typography key={phrase.id} variant="body2" color="text.secondary">
                                • {formatPreview(phrase.phrase)}
                            </Typography>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                        {t('cancel', 'Cancel')}
                    </Button>
                    <Button onClick={confirmDelete} color="error" disabled={deleting}>
                        {deleting ? <CircularProgress size={20} /> : t('delete', 'Delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
