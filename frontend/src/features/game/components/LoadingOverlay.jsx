import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

const LoadingOverlay = ({ isLoading, isDarkMode }) => {
    const { t } = useTranslation();

    if (!isLoading) return null;

    const themeClass = isDarkMode ? 'dark' : 'light';
    return (
        <Box 
            className={`loading-overlay ${themeClass}`}
            sx={{ position: 'absolute', inset: 0 }}
        >
            <Box className={`loading-content ${themeClass}`}>
                <CircularProgress size={40} color={isDarkMode ? 'inherit' : 'primary'} />
                <Box component="span">{t('loading_puzzle')}</Box>
            </Box>
        </Box>
    );
};

export default LoadingOverlay;
