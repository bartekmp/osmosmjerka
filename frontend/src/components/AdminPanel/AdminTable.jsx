import React, { useState } from 'react';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableRow, 
    TextField, 
    Button, 
    Box,
    TableContainer,
    Paper
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function AdminTable({ rows, setEditRow, onSaveRow, onDeleteRow }) {
    const { t } = useTranslation();
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [errors, setErrors] = useState({});

    const handleEdit = (row) => {
        setEditingId(row.id);
        setEditData({
            categories: row.categories,
            word: row.word,
            translation: row.translation
        });
        setErrors({});
    };

    const handleSave = () => {
        // Validate fields
        const newErrors = {};
        if (!editData.categories?.trim()) newErrors.categories = t('categories_required');
        if (!editData.word?.trim()) newErrors.word = t('word_required');
        if (!editData.translation?.trim()) newErrors.translation = t('translation_required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Save the row
        const updatedRow = {
            id: editingId,
            categories: editData.categories.trim(),
            word: editData.word.trim(),
            translation: editData.translation.trim()
        };

        onSaveRow(updatedRow);
        setEditingId(null);
        setEditData({});
        setErrors({});
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData({});
        setErrors({});
    };

    const handleDelete = (row) => {
        if (window.confirm(t('confirm_delete_word', { word: row.word }))) {
            onDeleteRow(row.id);
        }
    };

    const handleChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    return (
        <TableContainer 
            component={Paper} 
            sx={{ 
                mt: 2, 
                maxWidth: '100%',
                overflowX: 'auto',
                '& .MuiTable-root': {
                    minWidth: { xs: 700, md: 'auto' } // Force horizontal scroll on small screens
                },
                // Custom scrollbar styling
                '&::-webkit-scrollbar': {
                    height: 8,
                },
                '&::-webkit-scrollbar-track': {
                    backgroundColor: '#f1f1f1',
                    borderRadius: 4,
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#b89c4e',
                    borderRadius: 4,
                    '&:hover': {
                        backgroundColor: '#8a7429',
                    }
                }
            }}
        >
            <Table className="admin-table" size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>{t('categories')}</TableCell>
                        <TableCell>{t('word')}</TableCell>
                        <TableCell>{t('translation')}</TableCell>
                        <TableCell align="center">{t('actions')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map(row => (
                        <TableRow key={row.id}>
                            <TableCell className="admin-cell">
                                {row.id}
                            </TableCell>
                            <TableCell className={editingId === row.id ? "admin-cell-editable" : "admin-cell"}>
                                {editingId === row.id ? (
                                    <TextField
                                        value={editData.categories || ''}
                                        onChange={(e) => handleChange('categories', e.target.value)}
                                        size="small"
                                        fullWidth
                                        error={!!errors.categories}
                                        helperText={errors.categories}
                                        InputProps={{ className: 'admin-input' }}
                                    />
                                ) : (
                                    row.categories
                                )}
                            </TableCell>
                            <TableCell className={editingId === row.id ? "admin-cell-editable" : "admin-cell"}>
                                {editingId === row.id ? (
                                    <TextField
                                        value={editData.word || ''}
                                        onChange={(e) => handleChange('word', e.target.value)}
                                        size="small"
                                        fullWidth
                                        error={!!errors.word}
                                        helperText={errors.word}
                                        InputProps={{ className: 'admin-input' }}
                                    />
                                ) : (
                                    row.word
                                )}
                            </TableCell>
                            <TableCell className={editingId === row.id ? "admin-cell-editable" : "admin-cell"}>
                                {editingId === row.id ? (
                                    <TextField
                                        value={editData.translation || ''}
                                        onChange={(e) => handleChange('translation', e.target.value)}
                                        size="small"
                                        fullWidth
                                        error={!!errors.translation}
                                        helperText={errors.translation}
                                        InputProps={{ className: 'admin-input' }}
                                    />
                                ) : (
                                    row.translation
                                )}
                            </TableCell>
                            <TableCell className="admin-cell" align="center">
                                {editingId === row.id ? (
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <Button 
                                            size="small"
                                            onClick={handleSave}
                                            color="primary"
                                        >
                                            {t('save')}
                                        </Button>
                                        <Button 
                                            size="small"
                                            onClick={handleCancel}
                                            color="secondary"
                                        >
                                            {t('cancel')}
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <Button 
                                            size="small"
                                            onClick={() => handleEdit(row)}
                                        >
                                            {t('edit')}
                                        </Button>
                                        <Button 
                                            size="small"
                                            onClick={() => handleDelete(row)}
                                            color="error"
                                        >
                                            {t('delete')}
                                        </Button>
                                    </Box>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}