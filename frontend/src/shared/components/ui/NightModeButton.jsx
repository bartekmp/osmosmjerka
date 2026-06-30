import React from 'react';
import { Button } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeMode } from '../../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

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
                minWidth: 48,
                minHeight: 48,
                ...sx
            }}
            className={className}
            title={isDarkMode ? t('light_mode') : t('dark_mode')}
            aria-label={isDarkMode ? t('light_mode') : t('dark_mode')}
            {...rest}
        >
            {isDarkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </Button>
    );
}


NightModeButton.propTypes = {
  sx: PropTypes.object,
  className: PropTypes.string,
};