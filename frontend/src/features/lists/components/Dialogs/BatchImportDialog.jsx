import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Alert,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for batch importing phrases from a CSV file
 */
export default function BatchImportDialog({
    open,
    onClose,
    onImport,
    onFileSelect,
    loading,
    importFile,
    importData,
    importPreview,
    importResult,
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('privateListManager.phrases.importTitle', 'Import Phrases from CSV')}</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {t('privateListManager.phrases.importDescription', 'Upload a CSV file with phrases. Format: phrase; translation; categories (optional)')}
                    </Typography>
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={<UploadFileIcon />}
                        disabled={loading}
                        sx={{ mt: 1 }}
                    >
                        Select File
                        <input
                            type="file"
                            hidden
                            accept=".csv"
                            onChange={onFileSelect}
                        />
                    </Button>
                    {importFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Selected: {importFile.name} ({importData.length} phrases)
                        </Typography>
                    )}
                </Box>

                {importPreview.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>
                            Preview (first 10 rows):
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Phrase</TableCell>
                                    <TableCell>Translation</TableCell>
                                    <TableCell>Categories</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {importPreview.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.phrase}</TableCell>
                                        <TableCell>{item.translation}</TableCell>
                                        <TableCell>{item.categories || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                )}

                {importResult && (
                    <Box sx={{ mt: 2 }}>
                        <Alert severity={importResult.error_count > 0 ? 'warning' : 'success'}>
                            Imported: {importResult.added_count} | Errors: {importResult.error_count}
                        </Alert>
                        {importResult.errors && importResult.errors.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="error">
                                    First {importResult.errors.length} errors:
                                </Typography>
                                {importResult.errors.map((err, idx) => (
                                    <Typography key={idx} variant="caption" display="block">
                                        Row {err.index + 1}: {err.error}
                                    </Typography>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button
                    onClick={onImport}
                    variant="contained"
                    disabled={loading || importData.length === 0}
                >
                    Import {importData.length} Phrases
                </Button>
            </DialogActions>
        </Dialog>
    );
}

BatchImportDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    onFileSelect: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    importFile: PropTypes.object,
    importData: PropTypes.array,
    importPreview: PropTypes.array,
    importResult: PropTypes.shape({
        added_count: PropTypes.number,
        error_count: PropTypes.number,
        errors: PropTypes.arrayOf(
            PropTypes.shape({
                index: PropTypes.number,
                error: PropTypes.string,
            })
        ),
    }),
};

BatchImportDialog.defaultProps = {
    loading: false,
    importFile: null,
    importData: [],
    importPreview: [],
    importResult: null,
};
