import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function CategorySelector({ categories = [], selected, onSelect, disabled = false }) {
    const { t } = useTranslation();
    const hasCategories = Array.isArray(categories) && categories.length > 0;

    const handleChange = (event) => {
        if (disabled || !hasCategories) {
            return;
        }
        onSelect(event.target.value);
    };

    const value = hasCategories && categories.includes(selected) ? selected : '';

    return (
        <Box sx={{ minWidth: 130 }}>
            <FormControl
                fullWidth
                size="small"
                disabled={disabled || !hasCategories}
            >
                <InputLabel>{t('category')}</InputLabel>
                <Select
                    value={value}
                    label={t('category')}
                    onChange={handleChange}
                    displayEmpty
                    renderValue={(selectedValue) => {
                        if (!selectedValue) {
                            return (
                                <em>
                                    {hasCategories
                                        ? t('select_category', 'Select category')
                                        : t('no_categories_available', 'No categories available')}
                                </em>
                            );
                        }
                        return selectedValue;
                    }}
                >
                    <MenuItem value="" disabled={hasCategories}>
                        <em>
                            {hasCategories
                                ? t('select_category', 'Select category')
                                : t('no_categories_available', 'No categories available')}
                        </em>
                    </MenuItem>
                    {hasCategories && categories.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
