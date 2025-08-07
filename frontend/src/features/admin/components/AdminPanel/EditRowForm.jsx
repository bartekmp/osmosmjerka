import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, TextField, Typography, Paper, Stack, Autocomplete, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchCategories, invalidateCategoriesCache } from '../../../../utils/categoriesApi';

export default function EditRowForm({ editRow, setEditRow, handleSave }) {
    const { t } = useTranslation();
    const [availableCategories, setAvailableCategories] = useState([]);
    const [categoriesInputValue, setCategoriesInputValue] = useState('');

    // Fetch available categories from API
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const categories = await fetchCategories();
                setAvailableCategories(categories);
            } catch (error) {
                console.error('Failed to fetch categories:', error);
                setAvailableCategories([]);
            }
        };

        loadCategories();
    }, []);

    // Handle categories changes (for Autocomplete)
    const handleCategoriesChange = (event, newValue) => {
        const categoriesString = newValue.join(' ');
        setEditRow({ ...editRow, categories: categoriesString });
    };

    // Handle key press for space-separated input
    const handleCategoriesKeyDown = (event) => {
        if (event.key === ' ' && categoriesInputValue.trim()) {
            event.preventDefault();
            const newCategory = categoriesInputValue.trim();
            const currentCategories = categoriesArray;
            
            // Add the new category if it's not already in the list
            if (!currentCategories.includes(newCategory)) {
                const updatedCategories = [...currentCategories, newCategory];
                const categoriesString = updatedCategories.join(' ');
                setEditRow({ ...editRow, categories: categoriesString });
            }
            
            // Clear the input
            setCategoriesInputValue('');
        }
    };

    // Convert categories string to array for Autocomplete
    const categoriesArray = useMemo(() => {
        return editRow?.categories ? editRow.categories.split(' ').filter(Boolean) : [];
    }, [editRow?.categories]);

    // Enhanced save handler that invalidates cache if categories changed
    const enhancedHandleSave = () => {
        // Check if this is a new row or if categories might have changed
        const shouldInvalidateCache = !editRow?.id || editRow?.categories;
        
        if (shouldInvalidateCache) {
            invalidateCategoriesCache();
        }
        
        handleSave();
    };

    if (!editRow) return null;

    return (
        <Paper
            sx={{
                p: 3,
                mb: 3,
                maxWidth: 500,
                mx: 'auto',
                borderRadius: 2,
                boxShadow: 3
            }}
        >
            <Typography variant="h5" component="h3" gutterBottom align="center">
                {editRow.id ? t('edit_row') : t('add_row')}
            </Typography>
            <Stack spacing={2}>
                <Autocomplete
                    multiple
                    freeSolo
                    options={availableCategories}
                    value={categoriesArray}
                    onChange={handleCategoriesChange}
                    inputValue={categoriesInputValue}
                    onInputChange={(event, newInputValue) => setCategoriesInputValue(newInputValue)}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                            <Chip
                                variant="outlined"
                                label={option}
                                {...getTagProps({ index })}
                                sx={{
                                    backgroundColor: 'rgba(184, 156, 78, 0.1)',
                                    borderColor: '#b89c4e',
                                    color: 'text.primary',
                                    '& .MuiChip-deleteIcon': {
                                        color: '#b89c4e',
                                        '&:hover': {
                                            color: '#8a7429'
                                        }
                                    }
                                }}
                            />
                        ))
                    }
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t('categories')}
                            variant="outlined"
                            helperText={t('categories_help')}
                            onKeyDown={handleCategoriesKeyDown}
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
                    )}
                    sx={{
                        '& .MuiAutocomplete-popupIndicator': {
                            color: '#b89c4e'
                        },
                        '& .MuiAutocomplete-clearIndicator': {
                            color: '#b89c4e'
                        }
                    }}
                />
                <TextField
                    label={t('phrase')}
                    value={editRow?.phrase || ''}
                    onChange={e => setEditRow({ ...editRow, phrase: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <TextField
                    label={t('translation')}
                    value={editRow?.translation || ''}
                    onChange={e => setEditRow({ ...editRow, translation: e.target.value })}
                    fullWidth
                    variant="outlined"
                    multiline
                    minRows={2}
                    maxRows={6}
                    sx={{
                        '& .MuiInputBase-root': {
                            whiteSpace: 'pre-wrap'
                        }
                    }}
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                    <Button
                        variant="contained"
                        onClick={enhancedHandleSave}
                        color="primary"
                    >
                        {t('save')}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setEditRow(null)}
                        color="secondary"
                    >
                        {t('cancel')}
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}