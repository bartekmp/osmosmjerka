import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for creating a new private list
 */
export default function CreateListDialog({ open, onClose, onSubmit, loading }) {
    const { t } = useTranslation();
    const [listName, setListName] = useState('');

    const handleSubmit = () => {
        onSubmit(listName);
        setListName(''); // Reset after submit
    };

    const handleClose = () => {
        setListName(''); // Reset on close
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && listName.trim()) {
            handleSubmit();
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('privateListManager.lists.createNew')}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label={t('privateListManager.lists.listName')}
                    fullWidth
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    inputProps={{ maxLength: 100 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    {t('privateListManager.buttons.cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !listName.trim()}
                >
                    {t('privateListManager.buttons.create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

CreateListDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
};

CreateListDialog.defaultProps = {
    loading: false,
};
