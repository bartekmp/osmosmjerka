import React from 'react';
import { useRef, useState } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { ResponsiveActionButton, STORAGE_KEYS } from '../../../shared';
import PastePhraseDialog from './AdminPanel/PastePhraseDialog';
import UploadProgressDialog from './UploadProgressDialog';
import { uploadPhrasesInChunks } from './uploadPhrasesInChunks';

// Mirrors MAX_UPLOAD_SIZE on the backend. Chunking means no single request is ever
// this big, so the limit is enforced here instead of per request.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// FileReader rather than File.text(): it is supported everywhere the app runs and in
// jsdom, where File.text() does not exist.
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new window.FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsText(file);
    });
}

export default function UploadForm({ onUpload, selectedLanguageSetId = null, compact = false, forceMobileText = false }) {
    const { t } = useTranslation();
    const fileInputRef = useRef();
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success',
        autoHideDuration: 3000,
    });
    const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
    const [progress, setProgress] = useState(null);

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
        fileInputRef.current?.click();
    };

    const handleClose = () => setNotification((n) => ({ ...n, open: false }));

    const handleFileChange = async (e) => {
        setNotification((n) => ({ ...n, open: false }));
        if (!ensureLanguageSetSelected()) {
            e.target.value = '';
            return;
        }

        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (file.size > MAX_UPLOAD_BYTES) {
            setNotification({
                open: true,
                message: t('file_too_large', 'File is too large. Maximum size is {{size}} MB.', {
                    size: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)),
                }),
                severity: 'error',
                autoHideDuration: null,
            });
            return;
        }

        const languageSetId = getEffectiveLanguageSetId();
        setLoading(true);
        setProgress({ status: 'reading', processed: 0, total: 0 });

        try {
            const text = await readFileAsText(file);
            setProgress({ status: 'uploading', processed: 0, total: 0 });

            const { imported, total } = await uploadPhrasesInChunks({
                text,
                languageSetId,
                onProgress: ({ processed, total: rowCount }) =>
                    setProgress({ status: 'uploading', processed, total: rowCount }),
            });

            setProgress({ status: 'success', processed: imported, total });
        } catch (err) {
            setProgress({
                status: 'error',
                processed: err.imported || 0,
                total: err.total || 0,
                message: err.message || t('upload_failed'),
                failedAtLine: err.failedAtLine || null,
            });
        } finally {
            setLoading(false);
        }
    };

    // The dialog is the only place the result is reported, so closing it is what
    // refreshes the table - no 3-second snackbar to miss after a long upload.
    const handleProgressClose = () => {
        const succeeded = progress?.status === 'success';
        const importedSomething = (progress?.processed || 0) > 0;
        setProgress(null);
        if (succeeded || importedSomething) onUpload();
    };

    const buttonSx = (compact || forceMobileText) ? {} : { minWidth: { md: 200 } };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <ResponsiveActionButton
                fullWidth={false}
                onClick={handleButtonClick}
                loading={loading}
                icon={<UploadFileIcon fontSize="inherit" />}
                color="info"
                desktopText={t('upload_phrases', 'Upload phrases (file)')}
                mobileText={t('upload', 'Upload')}
                compact={compact}
                forceMobileText={forceMobileText}
                tooltip={t('upload_phrases', 'Upload phrases (file)')}
                ariaLabel={t('upload_phrases', 'Upload phrases (file)')}
                sx={buttonSx}
            />
            <ResponsiveActionButton
                fullWidth={false}
                onClick={() => setPasteDialogOpen(true)}
                variant="outlined"
                color="secondary"
                icon={<ContentPasteIcon fontSize="inherit" />}
                desktopText={t('paste_phrases', 'Paste phrases')}
                mobileText={t('paste', 'Paste')}
                compact={compact}
                forceMobileText={forceMobileText}
                tooltip={t('paste_phrases', 'Paste phrases')}
                ariaLabel={t('paste_phrases', 'Paste phrases')}
                sx={buttonSx}
            />
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
            {progress && (
                <UploadProgressDialog
                    open
                    status={progress.status}
                    processed={progress.processed}
                    total={progress.total}
                    message={progress.message}
                    failedAtLine={progress.failedAtLine}
                    onClose={handleProgressClose}
                />
            )}
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
        </>
    );
}

UploadForm.propTypes = {
    onUpload: PropTypes.func.isRequired,
    selectedLanguageSetId: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    compact: PropTypes.bool,
    forceMobileText: PropTypes.bool
};