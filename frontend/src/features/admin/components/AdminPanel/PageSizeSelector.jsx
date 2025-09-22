import React from 'react';
import {
    FormControl,
    MenuItem,
    Select,
    Box,
    Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function PageSizeSelector({ value, onChange, sx }) {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                {t('records_per_page')}:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    displayEmpty
                >
                    {PAGE_SIZE_OPTIONS.map(size => (
                        <MenuItem key={size} value={size}>
                            {size}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
