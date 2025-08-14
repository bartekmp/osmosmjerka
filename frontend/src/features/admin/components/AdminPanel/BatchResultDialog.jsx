import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Alert,
    Typography,
    Box
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function BatchResultDialog({ 
    open, 
    onClose, 
    operation, 
    result,
    autoClose = true
}) {
    const { t } = useTranslation();

    React.useEffect(() => {
        if (autoClose && open && result?.success) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [open, result?.success, autoClose, onClose]);

    const getTitle = () => {
        if (result?.success) {
            return t('operation_successful', 'Operation Successful');
        } else {
            return t('operation_failed', 'Operation Failed');
        }
    };

    const getMessage = () => {
        if (!result) return '';

        if (result.success) {
            switch (operation) {
                case 'delete':
                    return t('batch_delete_success', { count: result.affected || result.count });
                case 'add_category':
                    return t('batch_add_category_success', { 
                        category: result.category,
                        affected: result.affected,
                        count: result.count 
                    });
                case 'remove_category':
                    return t('batch_remove_category_success', { 
                        category: result.category,
                        affected: result.affected,
                        count: result.count 
                    });
                default:
                    return result.message || t('operation_completed', 'Operation completed');
            }
        } else {
            return t('batch_operation_error', { error: result.error || result.message || 'Unknown error' });
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    <Alert severity={result?.success ? 'success' : 'error'}>
                        <Typography variant="body1">
                            {getMessage()}
                        </Typography>
                    </Alert>
                    {result?.success && autoClose && (
                        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                            {t('auto_closing_in_seconds', 'This dialog will close automatically in a few seconds')}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">
                    {t('close', 'Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
