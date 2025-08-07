import React, { useState, useEffect } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    Alert,
    CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '@shared';

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

    useEffect(() => {
        loadLanguageSets();
    }, []);

    const loadLanguageSets = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(API_ENDPOINTS.LANGUAGE_SETS, {
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
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const url = editingSet 
                ? `${API_ENDPOINTS.LANGUAGE_SETS}/${editingSet.id}`
                : API_ENDPOINTS.LANGUAGE_SETS;
            
            const method = editingSet ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setDialogOpen(false);
                await loadLanguageSets();
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Failed to save language set');
            }
        } catch (err) {
            setError('Error saving language set: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (languageSet) => {
        if (!confirm(t('confirm_delete_language_set', { name: languageSet.display_name }))) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_ENDPOINTS.LANGUAGE_SETS}/${languageSet.id}`, {
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
                    {t('add_language_set')}
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
                                <TableCell>{set.name}</TableCell>
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
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleSave} variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : t('save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
