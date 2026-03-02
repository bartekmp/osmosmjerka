import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for confirming deletion of a private list
 */
export default function DeleteConfirmationDialog({ open, list, onClose, onConfirm, loading }) {
    const { t } = useTranslation();

    if (!list) return null;

    const isSystemList = list.is_system_list;

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{t('privateListManager.lists.confirmDelete')}</DialogTitle>
            <DialogContent>
                <Typography>
                    {t('privateListManager.lists.deleteWarning', { name: list.list_name })}
                </Typography>
                {isSystemList && (
                    <Typography color="error" sx={{ mt: 2 }}>
                        {t('privateListManager.lists.cannotDeleteSystem')}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    {t('privateListManager.buttons.cancel')}
                </Button>
                <Button
                    onClick={onConfirm}
                    color="error"
                    variant="contained"
                    disabled={loading || isSystemList}
                >
                    {t('privateListManager.buttons.delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

DeleteConfirmationDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    list: PropTypes.shape({
        list_name: PropTypes.string.isRequired,
        is_system_list: PropTypes.bool,
    }),
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    loading: PropTypes.bool,
};

DeleteConfirmationDialog.defaultProps = {
    list: null,
    loading: false,
};
