import React, { useState, useEffect, useRef } from 'react';
import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Button,
    Box,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    Alert,
    CircularProgress,
    Backdrop
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '@shared';
import { ResponsiveText } from '../../../../shared';

export default function LanguageSetManagement() {
    const { t } = useTranslation();
    const [languageSets, setLanguageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSet, setEditingSet] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        author: ''
    });
    const [file, setFile] = useState(null);
    const fileInputRef = useRef();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadLanguageSets();
    }, []);

    const loadLanguageSets = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN_LANGUAGE_SETS, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setLanguageSets(data);
            } else {
                setError('Failed to load language sets');
            }
        } catch (err) {
            setError('Error loading language sets: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingSet(null);
        setFormData({
            name: '',
            display_name: '',
            description: '',
            author: ''
        });
    setFile(null);
        setDialogOpen(true);
    };

    const handleEdit = (languageSet) => {
        setEditingSet(languageSet);
        setFormData({
            name: languageSet.name,
            display_name: languageSet.display_name,
            description: languageSet.description || '',
            author: languageSet.author || ''
        });
        setFile(null);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setLoading(true);
        try {
            const url = editingSet 
                ? `${API_ENDPOINTS.ADMIN_LANGUAGE_SETS}/${editingSet.id}`
                : API_ENDPOINTS.ADMIN_LANGUAGE_SETS;
            
            const method = editingSet ? 'PUT' : 'POST';
            // Always send JSON for metadata first
            const metaRes = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(formData)
            });

            if (!metaRes.ok) {
                const errorData = await metaRes.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detail || 'Failed to save language set');
            }

            // If a file was selected, perform upload step
            if (file) {
                let targetId = editingSet?.id;
                if (!editingSet) {
                    const data = await metaRes.json().catch(() => ({}));
                    targetId = data.id;
                }

                if (!targetId) {
                    throw new Error('Missing language set id for upload');
                }

                // If editing, erase previous contents before upload
                if (editingSet) {
                    await fetch(`${API_ENDPOINTS.ADMIN_CLEAR}?language_set_id=${targetId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
                    });
                }

                const form = new FormData();
                form.append('file', file);
                const uploadRes = await fetch(`/admin/upload?language_set_id=${encodeURIComponent(targetId)}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                    body: form
                });
                if (!uploadRes.ok) {
                    const errData = await uploadRes.json().catch(() => ({}));
                    throw new Error(errData.error || errData.detail || 'Upload failed');
                }
            }

            setDialogOpen(false);
            await loadLanguageSets();
        } catch (err) {
            setError('Error saving language set: ' + err.message);
        } finally {
            setLoading(false);
            setSaving(false);
        }
    };

    const handleDelete = async (languageSet) => {
        if (!confirm(t('confirm_delete_language_set', { name: languageSet.display_name }))) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_ENDPOINTS.ADMIN_LANGUAGE_SETS}/${languageSet.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                await loadLanguageSets();
            } else {
                setError('Failed to delete language set');
            }
        } catch (err) {
            setError('Error deleting language set: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setDialogOpen(false);
        setEditingSet(null);
        setFormData({
            name: '',
            display_name: '',
            description: '',
            author: ''
        });
        setFile(null);
    };

    const handleMakeDefault = async (languageSetId) => {
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.ADMIN_MAKE_DEFAULT(languageSetId), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || data.detail || 'Failed to set default');
            }
            await loadLanguageSets();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 3, mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" component="h2">
                    {t('language_sets_management')}
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                    disabled={loading}
                >
                <ResponsiveText desktop={t('add_language_set')} mobile={t('add_language_set_short')} />
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {loading && (
                <Box display="flex" justifyContent="center" py={3}>
                    <CircularProgress />
                </Box>
            )}

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('name')}</TableCell>
                            <TableCell>{t('display_name')}</TableCell>
                            <TableCell>{t('description')}</TableCell>
                            <TableCell>{t('author')}</TableCell>
                            <TableCell>{t('status')}</TableCell>
                            <TableCell>{t('created_at')}</TableCell>
                            <TableCell>{t('actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {languageSets.map((set) => (
                            <TableRow key={set.id}>
                                <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <span>{set.name}</span>
                                        {set.is_default && (
                                            <Chip size="small" color="warning" label={t('default', 'Default')} />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>{set.display_name}</TableCell>
                                <TableCell>{set.description}</TableCell>
                                <TableCell>{set.author}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={set.is_active ? t('active') : t('inactive')}
                                        color={set.is_active ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {new Date(set.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleEdit(set)}
                                        disabled={loading}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDelete(set)}
                                        disabled={loading}
                                        color="error"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                    {!set.is_default && (
                                        <Tooltip title={t('make_default', 'Make default')} arrow>
                                            <IconButton
                                                size="small"
                                                color="warning"
                                                onClick={() => handleMakeDefault(set.id)}
                                                aria-label={t('make_default', 'Make default')}
                                                disabled={loading}
                                                sx={{ border: 1, borderColor: 'divider' }}
                                            >
                                                <span role="img" aria-hidden>⭐</span>
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingSet ? t('edit_language_set') : t('create_language_set')}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label={t('name')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        margin="normal"
                        helperText={t('name_helper_text')}
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label={t('display_name')}
                        value={formData.display_name}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                        margin="normal"
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label={t('description')}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        margin="normal"
                        multiline
                        rows={2}
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label={t('author')}
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        margin="normal"
                        disabled={loading}
                    />
                    <Box mt={2}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.csv"
                            style={{ display: 'none' }}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                            {editingSet ? t('upload_new_phrases_replace', 'Upload phrases (replace)') : t('upload_initial_phrases', 'Upload phrases (initial)')}
                        </Button>
                        {file && (
                            <Typography variant="caption" sx={{ ml: 1 }}>
                                {file.name}
                            </Typography>
                        )}
                        {editingSet && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                                {t('upload_replace_hint', 'Uploading a file while editing will erase previous contents and replace them.')}
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleSave} variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : t('save')}
                    </Button>
                </DialogActions>
                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1, display: 'flex', flexDirection: 'column', gap: 2 }}
                    open={saving}
                >
                    <CircularProgress color="inherit" />
                    <Typography variant="body1" sx={{ textAlign: 'center' }}>
                        {t('saving_language_set', 'Saving language set, please wait...')}
                    </Typography>
                </Backdrop>
            </Dialog>
        </Paper>
    );
}
