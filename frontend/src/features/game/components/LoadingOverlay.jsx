import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

const LoadingOverlay = ({ isLoading, isDarkMode }) => {
    const { t } = useTranslation();

    if (!isLoading) return null;

    return (
        <Box className={`loading-overlay ${isDarkMode ? 'dark' : 'light'}`}>
            <Box className={`loading-content ${isDarkMode ? 'dark' : 'light'}`}>
                <CircularProgress 
                    size={40} 
                    color={isDarkMode ? 'inherit' : 'primary'} 
                />
                <Box component="span">{t('loading_puzzle')}</Box>
            </Box>
        </Box>
    );
};

export default LoadingOverlay;
