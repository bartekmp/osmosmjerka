import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const LoadingOverlay = ({ isLoading, isDarkMode, showMessage = true, transparent = false }) => {
    const { t } = useTranslation();

    if (!isLoading) return null;

    const themeClass = isDarkMode ? 'dark' : 'light';
    const transparentClass = transparent ? 'transparent' : '';

    return (
        <Box
            className={`loading-overlay ${themeClass} ${transparentClass}`}
            sx={{ position: 'absolute', inset: 0 }}
        >
            <Box className={`loading-content ${themeClass} ${transparentClass}`}>
                <CircularProgress size={40} color={isDarkMode ? 'inherit' : 'primary'} />
                {showMessage && <Box component="span">{t('loading_puzzle')}</Box>}
            </Box>
        </Box>
    );
};

export default LoadingOverlay;


LoadingOverlay.propTypes = {
    isLoading: PropTypes.bool.isRequired,
    isDarkMode: PropTypes.bool.isRequired,
    showMessage: PropTypes.bool,
    transparent: PropTypes.bool
};