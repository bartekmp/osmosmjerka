import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function CategorySelector({ categories, selected, onSelect }) {
    const { t } = useTranslation();
    return (
        <Box sx={{ minWidth: 130 }}>
            <FormControl fullWidth size="small">
                <InputLabel>{t('category')}</InputLabel>
                <Select
                    value={selected}
                    label={t('category')}
                    onChange={e => onSelect(e.target.value)}
                >
                    {categories.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
