import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    TextField,
    Button,
    IconButton,
    Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Function to check for HTML tags
const containsHTML = (text) => {
    const htmlRegex = /<[^>]*>/g;
    return htmlRegex.test(text);
};

export default function EditWordDialog({ 
    open, 
    row, 
    onClose, 
    onSave 
}) {
    const { t } = useTranslation();
    const [editData, setEditData] = useState({});
    const [errors, setErrors] = useState({});

    // Initialize edit data when dialog opens
    useEffect(() => {
        if (open && row) {
            setEditData({
                categories: row.categories,
                word: row.word,
                translation: row.translation
            });
            setErrors({});
        }
    }, [open, row]);

    // Handle field changes
    const handleEditChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    // Check if form data has changed from original
    const hasChanges = useMemo(() => {
        if (!row) return false;
        
        return (
            editData.categories !== row.categories ||
            editData.word !== row.word ||
            editData.translation !== row.translation
        );
    }, [editData, row]);

    // Handle form submission
    const handleSave = () => {
        const newErrors = {};
        
        // Validation
        if (!editData.categories?.trim()) {
            newErrors.categories = t('categories_required');
        }
        if (!editData.word?.trim()) {
            newErrors.word = t('word_required');
        }
        if (!editData.translation?.trim()) {
            newErrors.translation = t('translation_required');
        }

        // Check for HTML in fields
        if (editData.categories && containsHTML(editData.categories)) {
            newErrors.categories = t('html_not_allowed');
        }
        if (editData.word && containsHTML(editData.word)) {
            newErrors.word = t('html_not_allowed');
        }
        if (editData.translation && containsHTML(editData.translation)) {
            newErrors.translation = t('html_not_allowed');
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const updatedRow = {
            id: row.id,
            categories: editData.categories.trim(),
            word: editData.word.trim(),
            translation: editData.translation.trim()
        };

        onSave(updatedRow);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: 'background.paper',
                    backgroundFilter: 'blur(10px)'
                }
            }}
            BackdropProps={{
                sx: {
                    backdropFilter: 'blur(8px)',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                color: 'text.primary'
            }}>
                <Typography variant="h6">{t('edit_word')}</Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
                    {/* Categories Field */}
                    <TextField
                        label={t('categories')}
                        value={editData.categories || ''}
                        onChange={(e) => handleEditChange('categories', e.target.value)}
                        fullWidth
                        error={!!errors.categories}
                        helperText={errors.categories || t('categories_help')}
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                    borderColor: '#b89c4e',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#b89c4e',
                                },
                            }
                        }}
                    />

                    {/* Word Field */}
                    <TextField
                        label={t('word')}
                        value={editData.word || ''}
                        onChange={(e) => handleEditChange('word', e.target.value)}
                        fullWidth
                        error={!!errors.word}
                        helperText={errors.word}
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                    borderColor: '#b89c4e',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#b89c4e',
                                },
                            }
                        }}
                    />

                    {/* Translation Field - Multiline */}
                    <TextField
                        label={t('translation')}
                        value={editData.translation || ''}
                        onChange={(e) => handleEditChange('translation', e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                        error={!!errors.translation}
                        helperText={errors.translation || t('translation_multiline_help')}
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                    borderColor: '#b89c4e',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#b89c4e',
                                },
                            }
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{
                p: 3,
                backgroundColor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider',
                gap: 1
            }}>
                <Button 
                    onClick={onClose} 
                    variant="outlined"
                    sx={{
                        borderColor: 'text.secondary',
                        color: 'text.secondary',
                        '&:hover': {
                            borderColor: 'text.primary',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)'
                        }
                    }}
                >
                    {t('cancel')}
                </Button>
                <Button 
                    onClick={handleSave} 
                    variant="contained"
                    disabled={!hasChanges}
                    sx={{
                        backgroundColor: '#b89c4e',
                        '&:hover': {
                            backgroundColor: '#8a7429'
                        },
                        '&:disabled': {
                            backgroundColor: 'rgba(0, 0, 0, 0.12)',
                            color: 'rgba(0, 0, 0, 0.26)'
                        }
                    }}
                >
                    {t('save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
