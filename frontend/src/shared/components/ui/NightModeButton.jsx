import React from 'react';
import { Button } from '@mui/material';
import { useThemeMode } from '../../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

/**
 * NightModeButton - a reusable button for toggling dark/light mode.
 * Props:
 *   sx: MUI sx prop for custom styling
 *   className: optional className
 *   ...rest: any other Button props
 */
export default function NightModeButton({ sx = {}, className = '', ...rest }) {
    const { isDarkMode, toggleDarkMode } = useThemeMode();
    const { t } = useTranslation();
    return (
        <Button
            onClick={toggleDarkMode}
            sx={{
                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' }, // Unified responsive emoji size
                minWidth: 48,
                minHeight: 48,
                ...sx
            }}
            className={className}
            title={isDarkMode ? t('light_mode') : t('dark_mode')}
            {...rest}
        >
            {isDarkMode ? '☀️' : '🌙'}
        </Button>
    );
}
