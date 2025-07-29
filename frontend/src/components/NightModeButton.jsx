import React from 'react';
import { Button } from '@mui/material';
import { useThemeMode } from '../contexts/ThemeContext';

/**
 * NightModeButton - a reusable button for toggling dark/light mode.
 * Props:
 *   sx: MUI sx prop for custom styling
 *   className: optional className
 *   ...rest: any other Button props
 */
export default function NightModeButton({ sx = {}, className = '', ...rest }) {
    const { isDarkMode, toggleDarkMode } = useThemeMode();
    return (
        <Button
            onClick={toggleDarkMode}
            sx={sx}
            className={className}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            {...rest}
        >
            {isDarkMode ? '☀️' : '🌙'}
        </Button>
    );
}
