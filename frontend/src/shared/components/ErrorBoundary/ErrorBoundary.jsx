import React from 'react';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            isModuleError: false
        };
    }

    static getDerivedStateFromError(error) {
        // Check if it's a module loading error
        const isModuleError = error?.message?.includes('loading dynamically imported module') ||
            error?.message?.includes('Loading chunk') ||
            error?.message?.includes('ChunkLoadError');

        return {
            hasError: true,
            isModuleError
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return <ErrorDisplay
                error={this.state.error}
                isModuleError={this.state.isModuleError}
                onReload={this.handleReload}
                onRetry={this.handleRetry}
            />;
        }

        return this.props.children;
    }
}

const ErrorDisplay = ({ error, isModuleError, onReload, onRetry }) => {
    const { t } = useTranslation();

    const getErrorMessage = () => {
        if (isModuleError) {
            return {
                title: t('module_load_error_title', 'Failed to Load Application'),
                message: t('module_load_error_message', 'The application failed to load properly. This might be due to a network issue or server problem.'),
                suggestion: t('module_load_error_suggestion', 'Please try reloading the page. If the problem persists, check your internet connection or try again later.')
            };
        }

        return {
            title: t('generic_error_title', 'Something Went Wrong'),
            message: t('generic_error_message', 'An unexpected error occurred in the application.'),
            suggestion: t('generic_error_suggestion', 'Please try again. If the problem persists, contact support.')
        };
    };

    const errorDetails = getErrorMessage();

    return (
        <Container maxWidth="md" sx={{ py: 4, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <Paper
                sx={{
                    p: 4,
                    width: '100%',
                    textAlign: 'center',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: 3
                }}
            >
                {/* Error Icon */}
                <Box sx={{ fontSize: '4rem', mb: 2 }}>
                    {isModuleError ? '📡' : '⚠️'}
                </Box>

                {/* Error Title */}
                <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                    color="error"
                    sx={{ mb: 2 }}
                >
                    {errorDetails.title}
                </Typography>

                {/* Error Message */}
                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}
                >
                    {errorDetails.message}
                </Typography>

                {/* Error Suggestion */}
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}
                >
                    {errorDetails.suggestion}
                </Typography>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onReload}
                        size="large"
                    >
                        {t('reload_page', 'Reload Page')}
                    </Button>

                    {!isModuleError && (
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={onRetry}
                            size="large"
                        >
                            {t('try_again', 'Try Again')}
                        </Button>
                    )}
                </Box>

                {/* Technical Details (collapsible in development) */}
                {process.env.NODE_ENV === 'development' && error && (
                    <Box sx={{ mt: 4, textAlign: 'left' }}>
                        <Typography variant="h6" gutterBottom>
                            Technical Details:
                        </Typography>
                        <Paper
                            sx={{
                                p: 2,
                                bgcolor: 'grey.100',
                                maxHeight: 200,
                                overflow: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem'
                            }}
                        >
                            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {error.toString()}
                                {error.stack && `\n\nStack trace:\n${error.stack}`}
                            </Typography>
                        </Paper>
                    </Box>
                )}
            </Paper>
        </Container>
    );
};

export default ErrorBoundary;
