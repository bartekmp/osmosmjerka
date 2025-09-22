import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    TextField,
    Button,
    IconButton,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { STORAGE_KEYS } from '../../../../shared';

export default function PastePhraseDialog({ 
    open, 
    onClose, 
    onUpload,
    selectedLanguageSetId 
}) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [separator, setSeparator] = useState('auto'); // 'auto', ';', ',', '|', 'tab'
    const [previewRows, setPreviewRows] = useState([]);
    const [previewError, setPreviewError] = useState('');
    const [error, setError] = useState('');

    const getEffectiveLanguageSetId = () => {
        const fromProps = selectedLanguageSetId ?? null;
        if (fromProps) return fromProps;
        const fromStorage = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
        return fromStorage ? parseInt(fromStorage) : null;
    };

    const ensureLanguageSetSelected = () => {
        const effective = getEffectiveLanguageSetId();
        if (!effective) {
            setError(t('no_language_sets_error') || 'Please select a language set first.');
            return false;
        }
        return true;
    };

    const handlePasteTextChange = (val) => {
        setPasteText(val);
        setError('');
        
        // simple client-side preview parse
        try {
            const lines = val.split(/\r?\n/).filter(l => l.trim());
            if (!lines.length) { 
                setPreviewRows([]); 
                setPreviewError(''); 
                return; 
            }
            const first = lines[0].replace(/^\uFEFF/, '');
            const sep = (separator === 'auto') ? ([';', ',', '|', '\t'].find(d => first.includes(d)) || ';') : (separator === 'tab' ? '\t' : separator);
            const hasHeader = /^(categories|category)\s*Q${sep}E\s*phrase\s*Q${sep}E\s*translation$/i.test(first);
            const dataLines = hasHeader ? lines.slice(1) : lines;
            const parsed = dataLines.slice(0, 5).map(l => l.split(sep));
            // basic validation
            const bad = parsed.find(p => p.length < 3 || p.slice(0,3).some(x => !String(x).trim()));
            setPreviewRows(parsed.map(p => p.slice(0,3)));
            setPreviewError(bad ? t('operation_failed', 'Invalid row detected') : '');
        } catch {
            setPreviewRows([]);
            setPreviewError(t('operation_failed', 'Preview failed'));
        }
    };

    const handleSubmit = async () => {
        if (!ensureLanguageSetSelected()) return;
        if (!pasteText.trim()) return;
        
        setLoading(true);
        setError('');
        
        try {
            const token = localStorage.getItem('adminToken');
            const headers = {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: 'Bearer ' + token } : {})
            };
            const languageSetId = getEffectiveLanguageSetId();
            const url = `/admin/upload-text?language_set_id=${encodeURIComponent(languageSetId)}`;
            const payload = {
                content: pasteText,
                ...(separator && separator !== 'auto' ? { separator } : {})
            };
            const _ = await axios.post(url, payload, { headers });
            
            // Success - close dialog and refresh data
            handleClose();
            onUpload();
        } catch (err) {
            let msg = t('upload_failed', 'Upload failed');
            if (err.response && err.response.data) {
                const d = err.response.data;
                msg = d.message || d.detail || d.error || msg;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPasteText('');
        setSeparator('auto');
        setPreviewRows([]);
        setPreviewError('');
        setError('');
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: 'background.paper',
                    backgroundFilter: 'blur(10px)'
                }
            }}
            BackdropProps={{
                sx: {
                    backdropFilter: 'blur(8px)',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                color: 'text.primary'
            }}>
                {t('paste_phrases', 'Paste Phrases')}
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ pt: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Instructions */}
                    <Typography variant="body2" color="text.secondary">
                        {t('paste_instructions', 'Paste lines in the format: categories;phrase;translation. The first line can be the header defining the separator.')}
                    </Typography>

                    {/* Separator Selection */}
                    <FormControl size="small" sx={{ maxWidth: 200 }}>
                        <InputLabel id="separator-label">{t('separator', 'Separator')}</InputLabel>
                        <Select
                            labelId="separator-label"
                            label={t('separator', 'Separator')}
                            value={separator}
                            onChange={(e) => setSeparator(e.target.value)}
                        >
                            <MenuItem value="auto">{t('auto_detect', 'Auto-detect')}</MenuItem>
                            <MenuItem value=";">;</MenuItem>
                            <MenuItem value=",">,</MenuItem>
                            <MenuItem value="|">|</MenuItem>
                            <MenuItem value="tab">{t('tab', 'Tab')}</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Text Input */}
                    <TextField
                        fullWidth
                        multiline
                        rows={12}
                        placeholder={t('paste_placeholder', 'categories;phrase;translation\nA;hello;hi')}
                        value={pasteText}
                        onChange={(e) => handlePasteTextChange(e.target.value)}
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '&:hover fieldset': {
                                    borderColor: '#b89c4e',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#b89c4e',
                                },
                            }
                        }}
                    />

                    {/* Preview */}
                    {previewRows.length > 0 && (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                {t('preview', 'Preview')}:
                            </Typography>
                            <Box sx={{ 
                                fontSize: 12, 
                                color: previewError ? 'error.main' : 'text.secondary',
                                bgcolor: 'background.default',
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1,
                                fontFamily: 'monospace'
                            }}>
                                <div><b>{t('categories', 'Categories')} | {t('phrase', 'Phrase')} | {t('translation', 'Translation')}</b></div>
                                {previewRows.map((r, i) => (
                                    <div key={i}>{(r[0]||'').toString()} | {(r[1]||'').toString()} | {(r[2]||'').toString()}</div>
                                ))}
                                {previewError && (
                                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                                        {previewError}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Error Display */}
                    {error && (
                        <Typography variant="body2" color="error">
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            
            <DialogActions sx={{
                p: 3,
                backgroundColor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider',
                gap: 1
            }}>
                <Button 
                    onClick={handleClose} 
                    variant="outlined"
                    sx={{
                        borderColor: 'text.secondary',
                        color: 'text.secondary',
                        '&:hover': {
                            borderColor: 'text.primary',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)'
                        }
                    }}
                >
                    {t('cancel', 'Cancel')}
                </Button>
                <Button 
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !pasteText.trim() || !!previewError}
                    sx={{
                        backgroundColor: '#b89c4e',
                        '&:hover': {
                            backgroundColor: '#a08a45'
                        },
                        '&:disabled': {
                            backgroundColor: 'rgba(184, 156, 78, 0.12)'
                        }
                    }}
                >
                    {loading ? (
                        <>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            {t('uploading', 'Uploading...')}
                        </>
                    ) : (
                        t('upload_paste', 'Upload Pasted')
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
