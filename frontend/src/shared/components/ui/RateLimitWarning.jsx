import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Component to show rate limit warnings to users
 */
export const RateLimitWarning = ({ 
    show, 
    onClose, 
    message, 
    severity = 'warning',
    autoHideDuration = 4000 
}) => {
    const { t } = useTranslation();

    const defaultMessage = t('common.rateLimitWarning', 
        'Please wait before making another request. Your request is being processed.');

    return (
        <Snackbar 
            open={show} 
            onClose={onClose}
            autoHideDuration={autoHideDuration}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
            <Alert 
                severity={severity} 
                onClose={onClose}
                sx={{ 
                    '& .MuiAlert-message': {
                        fontSize: '0.9rem'
                    }
                }}
            >
                {message || defaultMessage}
            </Alert>
        </Snackbar>
    );
};

/**
 * Component for showing loading state with optional rate limit warning
 */
export const LoadingWithRateLimit = ({ 
    isLoading, 
    showRateLimit, 
    onRateLimitClose, 
    children,
    loadingMessage,
    rateLimitMessage 
}) => {
    const { t } = useTranslation();

    return (
        <>
            {children}
            <RateLimitWarning 
                show={showRateLimit}
                onClose={onRateLimitClose}
                message={rateLimitMessage}
            />
        </>
    );
};
