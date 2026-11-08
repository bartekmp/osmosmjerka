import React from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Blocking progress dialog for a chunked phrase upload.
 *
 * While status is 'uploading' there is no way out: no close button, no Escape, no
 * backdrop click. That is deliberate - the upload writes to the database in chunks,
 * and letting the admin navigate away mid-run leaves a half-imported language set.
 */
export default function UploadProgressDialog({
    open,
    status,
    processed = 0,
    total = 0,
    message = '',
    failedAtLine = null,
    onClose,
}) {
    const { t } = useTranslation();
    const uploading = status === 'uploading';
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

    const title = {
        reading: t('reading_file', 'Reading file...'),
        uploading: t('uploading_phrases', 'Uploading phrases'),
        success: t('upload_successful', 'Upload successful'),
        error: t('upload_failed', 'Upload failed.'),
    }[status] || t('uploading_phrases', 'Uploading phrases');

    return (
        <Dialog
            open={open}
            onClose={uploading ? undefined : onClose}
            disableEscapeKeyDown={uploading}
            maxWidth="xs"
            fullWidth
            slotProps={{
                backdrop: {
                    sx: {
                        backdropFilter: 'blur(4px)',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    },
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>

            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {status !== 'error' && (
                        <Box>
                            <LinearProgress
                                variant={total > 0 ? 'determinate' : 'indeterminate'}
                                value={percent}
                                sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {total > 0
                                        ? t('upload_progress_count', '{{processed}} of {{total}} phrases', {
                                            processed,
                                            total,
                                        })
                                        : t('reading_file', 'Reading file...')}
                                </Typography>
                                {total > 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        {percent}%
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {uploading && (
                        <Typography variant="caption" color="text.secondary">
                            {t('upload_keep_open', 'Keep this window open until the upload finishes.')}
                        </Typography>
                    )}

                    {status === 'success' && (
                        <Alert severity="success">
                            {t('upload_imported', 'Imported {{count}} phrases.', { count: processed })}
                        </Alert>
                    )}

                    {status === 'error' && (
                        <Alert severity="error">
                            <Typography variant="body2">{message}</Typography>
                            {processed > 0 && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {t('upload_partial', 'Imported {{imported}} of {{total}} phrases, then the upload stopped.', {
                                        imported: processed,
                                        total,
                                    })}
                                </Typography>
                            )}
                            {failedAtLine ? (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {t('upload_failed_at_line', 'The problem is at or after line {{line}} of the file.', {
                                        line: failedAtLine,
                                    })}
                                </Typography>
                            ) : null}
                        </Alert>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={uploading} variant="contained">
                    {t('close', 'Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

UploadProgressDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    status: PropTypes.oneOf(['reading', 'uploading', 'success', 'error']).isRequired,
    processed: PropTypes.number,
    total: PropTypes.number,
    message: PropTypes.string,
    failedAtLine: PropTypes.number,
    onClose: PropTypes.func.isRequired,
};
