import React from 'react';
import {
    Box,
    Button,
    Stack,
    Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

export default function BatchOperationsToolbar({ 
    selectedCount,
    onBatchDelete,
    onBatchAddCategory,
    onBatchRemoveCategory,
    disabled = false
}) {
    const { t } = useTranslation();

    if (selectedCount === 0) return null;

    return (
        <Box sx={{
            mt: 2,
            p: 2,
            bgcolor: 'warning.light',
            borderRadius: 1,
            border: 1,
            borderColor: 'warning.main'
        }}>
            <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                spacing={2} 
                alignItems={{ xs: 'stretch', sm: 'center' }}
                divider={<Divider orientation="vertical" flexItem />}
            >
                <Button
                    variant="contained"
                    color="error"
                    onClick={onBatchDelete}
                    disabled={disabled}
                    size="small"
                    sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                >
                    {t('batch_delete')} ({selectedCount})
                </Button>
                
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onBatchAddCategory}
                    disabled={disabled}
                    size="small"
                    sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                >
                    {t('batch_add_category')} ({selectedCount})
                </Button>
                
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={onBatchRemoveCategory}
                    disabled={disabled}
                    size="small"
                    sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                >
                    {t('batch_remove_category')} ({selectedCount})
                </Button>
            </Stack>
        </Box>
    );
}


BatchOperationsToolbar.propTypes = {
  selectedCount: PropTypes.number.isRequired,
  onBatchDelete: PropTypes.func.isRequired,
  onBatchAddCategory: PropTypes.func.isRequired,
  onBatchRemoveCategory: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};