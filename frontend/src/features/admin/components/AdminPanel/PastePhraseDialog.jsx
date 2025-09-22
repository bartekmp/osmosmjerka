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
    const [detectedSeparator, setDetectedSeparator] = useState(null); // one of ';', ',', '|', '\t'

    // For UI examples:
    // - Display (instructions): show a visible "<TAB>" when tab is selected
    // - Input (placeholder): use a real tab char when tab is selected
    const uiSepCharInput = separator === 'auto' ? ';' : (separator === 'tab' ? '\t' : separator);
    const uiSepCharDisplay = separator === 'auto' ? ';' : (separator === 'tab' ? '<TAB>' : separator);

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

    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Detect a likely separator by checking counts across the first few non-empty lines
    const detectSeparator = (lines) => {
        const candidates = [';', ',', '|', '\t'];
        const sample = lines.slice(0, 5);
        let best = null;
        let bestScore = -1;
        for (const cand of candidates) {
            // score by how many lines have at least 2 separators (=> 3 columns)
            const score = sample.reduce((acc, l) => acc + ((l.split(cand).length - 1) >= 2 ? 1 : 0), 0);
            if (score > bestScore) {
                bestScore = score;
                best = cand;
            }
        }
        // require at least one line with two separators
        return bestScore > 0 ? best : null;
    };

    const parseAndPreview = (val, sepSetting) => {
        setError('');
        try {
            const lines = val.split(/\r?\n/).filter(l => l.trim());
            if (!lines.length) {
                setPreviewRows([]);
                setPreviewError('');
                setDetectedSeparator(null);
                return;
            }

            const first = lines[0].replace(/^\uFEFF/, '');
            let sepChar = null;
            let usedSepLabel = null; // what user selected or auto-detected (for messages)
            if (sepSetting === 'auto') {
                sepChar = detectSeparator(lines);
                if (!sepChar) {
                    setPreviewRows([]);
                    setPreviewError(t('separator_not_detected', 'Could not detect a separator. Try selecting one.'));
                    setDetectedSeparator(null);
                    return;
                }
                usedSepLabel = (sepChar === '\t') ? 'tab' : sepChar;
                setDetectedSeparator(sepChar);
            } else {
                sepChar = (sepSetting === 'tab') ? '\t' : sepSetting;
                usedSepLabel = sepSetting;
                setDetectedSeparator(null);
                // Validate: ensure first line contains separator and produces >=3 columns
                const parts = first.split(sepChar);
                if (parts.length < 3) {
                    setPreviewRows([]);
                    setPreviewError(t('separator_mismatch', 'Input does not match the selected separator "{{sep}}".', { sep: usedSepLabel }));
                    return;
                }
            }

            // Optional header detection: categories, phrase, translation
            const sepRe = new RegExp(`\\s*${escapeRegExp(sepChar)}\\s*`);
            const headerPattern = new RegExp(`^(categories|category)${sepRe.source}phrase${sepRe.source}translation$`, 'i');
            const hasHeader = headerPattern.test(first.replace(/\s+/g, ' ').trim());
            const dataLines = hasHeader ? lines.slice(1) : lines;

            const parsed = dataLines.slice(0, 5).map(l => l.split(sepChar));
            const bad = parsed.find(p => p.length < 3 || p.slice(0, 3).some(x => !String(x).trim()));
            setPreviewRows(parsed.map(p => p.slice(0, 3)));
            setPreviewError(bad ? t('invalid_row_detected', 'Invalid row detected') : '');
        } catch {
            setPreviewRows([]);
            setPreviewError(t('operation_failed', 'Preview failed'));
            setDetectedSeparator(null);
        }
    };

    const handlePasteTextChange = (val) => {
        setPasteText(val);
        parseAndPreview(val, separator);
    };

    const handleSubmit = async () => {
        if (!ensureLanguageSetSelected()) return;
        if (!pasteText.trim()) return;
        // Do not submit when there is a preview error
        if (previewError) return;
        
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
            // Decide which separator to send to backend
            let payloadSeparator = null;
            if (separator === 'auto') {
                // prefer detected separator; if none, backend may try; still safer to block earlier
                payloadSeparator = detectedSeparator ? (detectedSeparator === '\t' ? 'tab' : detectedSeparator) : null;
            } else {
                payloadSeparator = separator;
            }

            const payload = {
                content: pasteText,
                ...(payloadSeparator ? { separator: payloadSeparator } : {})
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
                        {t(
                            'paste_instructions_base',
                            'Paste lines in the format: categories{{sep}}phrase{{sep}}translation.',
                            { sep: uiSepCharDisplay }
                        )}
                        {separator === 'auto' ?
                            ' ' + t(
                                'paste_instructions_header_note',
                                'The first line can be the header defining the separator.'
                            ) : ''}
                    </Typography>

                    {/* Separator Selection */}
                    <FormControl size="small" sx={{ maxWidth: 200 }}>
                        <InputLabel id="separator-label">{t('separator', 'Separator')}</InputLabel>
                        <Select
                            labelId="separator-label"
                            label={t('separator', 'Separator')}
                            value={separator}
                            onChange={(e) => {
                                const newSep = e.target.value;
                                setSeparator(newSep);
                                // re-parse with new separator selection
                                if (pasteText) parseAndPreview(pasteText, newSep);
                            }}
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
                        placeholder={t(
                            'paste_placeholder',
                            `categories${uiSepCharInput}phrase${uiSepCharInput}translation\nA${uiSepCharInput}hello${uiSepCharInput}hi`
                        )}
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
                                {separator === 'auto' && detectedSeparator && (
                                    <div style={{ marginBottom: 8 }}>
                                        {t('detected_separator', 'Detected separator')}: {detectedSeparator === '\t' ? t('tab', 'Tab') : detectedSeparator}
                                    </div>
                                )}
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
