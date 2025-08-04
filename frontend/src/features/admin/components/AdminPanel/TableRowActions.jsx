import React from 'react';
import { Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function TableRowActions({ 
    row,
    onEdit,
    onDelete
}) {
    const { t } = useTranslation();
    
    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
                size="small"
                onClick={() => onEdit(row)}
                sx={{ minWidth: '60px', fontSize: '0.75rem' }}
            >
                {t('edit')}
            </Button>
            <Button
                size="small"
                onClick={() => onDelete(row)}
                color="error"
                sx={{ minWidth: '60px', fontSize: '0.75rem' }}
            >
                {t('delete')}
            </Button>
        </Box>
    );
}
