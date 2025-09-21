import React from 'react';
import axios from 'axios';
import { useRef, useState } from 'react';
import { Button, Box, Typography, CircularProgress, Snackbar, Alert, IconButton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { ResponsiveText, STORAGE_KEYS } from '../../../shared';
import PastePhraseDialog from './AdminPanel/PastePhraseDialog';

export default function UploadForm({ onUpload, selectedLanguageSetId }) {
    const { t } = useTranslation();
    const fileInputRef = useRef();
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success', // 'success' or 'error'
        autoHideDuration: 3000, // ms, only for success
    });
    const [pasteDialogOpen, setPasteDialogOpen] = useState(false);

    const getEffectiveLanguageSetId = () => {
        const fromProps = selectedLanguageSetId ?? null;
        if (fromProps) return fromProps;
        const fromStorage = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
        return fromStorage ? parseInt(fromStorage) : null;
    };

    const ensureLanguageSetSelected = () => {
        const effective = getEffectiveLanguageSetId();
        if (!effective) {
            setNotification({
                open: true,
                message: t('no_language_sets_error') || 'Please select a language set first.',
                severity: 'error',
                autoHideDuration: null,
            });
            return false;
        }
        return true;
    };

    const handleButtonClick = () => {
        if (!ensureLanguageSetSelected()) return;
        fileInputRef.current.click();
    };

    const handleClose = () => setNotification((n) => ({ ...n, open: false }));

    const handleFileChange = async (e) => {
        setNotification((n) => ({ ...n, open: false }));
        if (!ensureLanguageSetSelected()) {
            e.target.value = "";
            return;
        }
        setLoading(true);
        const file = e.target.files[0];
        if (!file) {
            setLoading(false);
            return;
        }
        const formData = new FormData();
        formData.append('file', file);

        // Get token from localStorage
        const token = localStorage.getItem('adminToken');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        const languageSetId = getEffectiveLanguageSetId();

        try {
            const url = `/admin/upload?language_set_id=${encodeURIComponent(languageSetId)}`;
            const res = await axios.post(url, formData, { headers });
            setNotification({
                open: true,
                message: res.data.message || t('upload_successful'),
                severity: 'success',
                autoHideDuration: 3000,
            });
            onUpload();
        } catch (err) {
            let msg = t('upload_failed');
            if (err.response && err.response.data && (err.response.data.message || err.response.data.detail)) {
                msg = err.response.data.message || err.response.data.detail;
            }
            setNotification({
                open: true,
                message: msg,
                severity: 'error',
                autoHideDuration: null,
            });
        } finally {
            setLoading(false);
            e.target.value = ""; // allows selecting the same file again
        }
    };

    return (
        <Box sx={{ width: '100%', position: 'relative' }}>
            <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button 
                    fullWidth 
                    variant="contained" 
                    color="info" 
                    onClick={handleButtonClick}
                    size="small"
                    disabled={loading}
                >
                    <span style={{ marginRight: '4px' }}>📁</span>
                    <ResponsiveText 
                        desktop={t('upload_phrases', 'Upload phrases (file)')} 
                        mobile={t('upload', 'Upload')} 
                    />
                    {loading && <CircularProgress size={20} sx={{ ml: 1 }} />}
                </Button>
                <Button
                    fullWidth
                    variant="outlined"
                    color="secondary"
                    size="small"
                    onClick={() => setPasteDialogOpen(true)}
                >
                    <span style={{ marginRight: '4px' }}>📝</span>
                    <ResponsiveText desktop={t('paste_phrases', 'Paste phrases')} mobile={t('paste', 'Paste')} />
                </Button>
            </Stack>

            <PastePhraseDialog
                open={pasteDialogOpen}
                onClose={() => setPasteDialogOpen(false)}
                onUpload={() => {
                    setPasteDialogOpen(false);
                    setNotification({
                        open: true,
                        message: t('upload_successful', 'Upload successful'),
                        severity: 'success',
                        autoHideDuration: 3000,
                    });
                    onUpload();
                }}
                selectedLanguageSetId={selectedLanguageSetId}
            />

            <Snackbar
                open={notification.open}
                autoHideDuration={notification.severity === 'success' ? notification.autoHideDuration : null}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    severity={notification.severity}
                    action={
                        <IconButton size="small" color="inherit" onClick={handleClose}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    }
                    onClose={handleClose}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}