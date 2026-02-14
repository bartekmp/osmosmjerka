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
 * Dialog for adding a custom phrase to a private list
 */
export default function AddCustomPhraseDialog({ open, onClose, onSubmit, loading }) {
    const { t } = useTranslation();
    const [phrase, setPhrase] = useState('');
    const [translation, setTranslation] = useState('');
    const [categories, setCategories] = useState('');

    const handleSubmit = () => {
        onSubmit(phrase, translation, categories);
        // Reset after submit
        setPhrase('');
        setTranslation('');
        setCategories('');
    };

    const handleClose = () => {
        // Reset on close
        setPhrase('');
        setTranslation('');
        setCategories('');
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey && phrase.trim() && translation.trim()) {
            handleSubmit();
        }
    };

    const canSubmit = phrase.trim() && translation.trim();

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('privateListManager.phrases.addCustom')}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label={t('privateListManager.phrases.phrase')}
                    fullWidth
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                />
                <TextField
                    margin="dense"
                    label={t('privateListManager.phrases.translation')}
                    fullWidth
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                />
                <TextField
                    margin="dense"
                    label={t('privateListManager.phrases.categories')}
                    fullWidth
                    value={categories}
                    onChange={(e) => setCategories(e.target.value)}
                    onKeyPress={handleKeyPress}
                    helperText={t('privateListManager.phrases.categoriesHelp')}
                    disabled={loading}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    {t('privateListManager.buttons.cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !canSubmit}
                >
                    {t('privateListManager.buttons.add')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

AddCustomPhraseDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    loading: PropTypes.bool,
};

AddCustomPhraseDialog.defaultProps = {
    loading: false,
};
