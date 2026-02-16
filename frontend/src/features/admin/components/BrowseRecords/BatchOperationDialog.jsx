import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Alert,
    Box,
    Chip,
    Stack,
    Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

export default function BatchOperationDialog({ 
    open, 
    onClose, 
    operation, 
    selectedCount, 
    onConfirm,
    availableCategories = []
}) {
    const { t } = useTranslation();
    const [categoryName, setCategoryName] = useState('');
    const [error, setError] = useState('');

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (!open) {
            setCategoryName('');
            setError('');
        }
    }, [open]);

    const handleCategoryChipClick = (category) => {
        setCategoryName(category);
        setError('');
    };

    const handleConfirm = () => {
        if ((operation === 'add_category' || operation === 'remove_category') && !categoryName.trim()) {
            setError(t('category_name_required'));
            return;
        }
        setError('');
        onConfirm(categoryName.trim());
        setCategoryName('');
        onClose();
    };

    const handleClose = () => {
        setCategoryName('');
        setError('');
        onClose();
    };

    const getTitle = () => {
        switch (operation) {
            case 'delete':
                return t('batch_delete');
            case 'add_category':
                return t('batch_add_category');
            case 'remove_category':
                return t('batch_remove_category');
            default:
                return t('batch_operations');
        }
    };

    const getMessage = () => {
        switch (operation) {
            case 'delete':
                return t('batch_delete_confirm', { count: selectedCount });
            case 'add_category':
                return t('batch_add_category_confirm', { 
                    category: categoryName.trim(), 
                    count: selectedCount 
                });
            case 'remove_category':
                return t('batch_remove_category_confirm', { 
                    category: categoryName.trim(), 
                    count: selectedCount 
                });
            default:
                return '';
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    {(operation === 'add_category' || operation === 'remove_category') && (
                        <>
                            <TextField
                                fullWidth
                                label={t('enter_category_name')}
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                error={!!error}
                                helperText={error}
                                autoFocus
                                sx={{ mb: 2 }}
                            />
                            
                            {/* Available Categories */}
                            {availableCategories.length > 0 && (
                                <>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                        {t('available_categories')}
                                    </Typography>
                                    <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary' }}>
                                        {t('click_category_to_select', 'Click on a category to select it')}
                                    </Typography>
                                    <Stack 
                                        direction="row" 
                                        spacing={0.5} 
                                        flexWrap="wrap" 
                                        useFlexGap 
                                        sx={{ mb: 2, maxHeight: 120, overflowY: 'auto' }}
                                    >
                                        {availableCategories.map(category => (
                                            <Chip
                                                key={category}
                                                label={category}
                                                onClick={() => handleCategoryChipClick(category)}
                                                variant={categoryName === category ? "filled" : "outlined"}
                                                color={categoryName === category ? "primary" : "default"}
                                                size="small"
                                                sx={{ 
                                                    cursor: 'pointer',
                                                    mb: 0.5,
                                                    '&:hover': {
                                                        backgroundColor: categoryName === category 
                                                            ? 'primary.dark' 
                                                            : 'action.hover'
                                                    }
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </>
                            )}
                            
                            {categoryName.trim() && (
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    {getMessage()}
                                </Typography>
                            )}
                        </>
                    )}
                    
                    {operation === 'delete' && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {getMessage()}
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>
                    {t('cancel')}
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained"
                    color={operation === 'delete' ? 'error' : 'primary'}
                    disabled={
                        (operation === 'add_category' || operation === 'remove_category') && 
                        !categoryName.trim()
                    }
                >
                    {t('confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}


BatchOperationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  operation: PropTypes.string.isRequired,
  selectedCount: PropTypes.number.isRequired,
  onConfirm: PropTypes.func.isRequired,
  availableCategories: PropTypes.array.isRequired,
};