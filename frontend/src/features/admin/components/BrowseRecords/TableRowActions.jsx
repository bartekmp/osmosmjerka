import React from 'react';
import { Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
                aria-label={t('edit')}
                title={t('edit')}
                sx={{ minWidth: 0, width: 36, height: 36, fontSize: '1.1rem', lineHeight: 1 }}
            >
                <EditIcon fontSize="small" />
            </Button>
            <Button
                size="small"
                onClick={() => onDelete(row)}
                color="error"
                aria-label={t('delete')}
                title={t('delete')}
                sx={{ minWidth: 0, width: 36, height: 36, fontSize: '1.1rem', lineHeight: 1 }}
            >
                <DeleteIcon fontSize="small" />
            </Button>
        </Box>
    );
}
