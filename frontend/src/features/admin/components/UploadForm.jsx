import React from 'react';
import axios from 'axios';
import { useRef, useState } from 'react';
import { Button, Box, Typography, CircularProgress, Snackbar, Alert, IconButton, TextField, FormControl, InputLabel, Select, MenuItem, Collapse, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { ResponsiveText, STORAGE_KEYS } from '../../../shared';

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
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [separator, setSeparator] = useState('auto'); // 'auto', ';', ',', '|', 'tab'
    const [previewRows, setPreviewRows] = useState([]);
    const [previewError, setPreviewError] = useState('');
    const [serverSummary, setServerSummary] = useState('');
    const [serverErrorLineNum, setServerErrorLineNum] = useState(null);
    const [serverErrorLine, setServerErrorLine] = useState('');

    const extractLineInfo = (msg) => {
        if (!msg || typeof msg !== 'string') return { n: null, l: '' };
        // Try to find: "Line 5: ... Line: 'the raw line'"
        let m = msg.match(/Line\s+(\d+).*?Line:\s*'([^']*)'/);
        if (m) return { n: parseInt(m[1]), l: m[2] };
        // Try to find: "Line 5: ..."
        m = msg.match(/Line\s+(\d+):/);
        if (m) return { n: parseInt(m[1]), l: '' };
        // Try to find: "First line: '..." -> assume line 1
        m = msg.match(/First line:\s*'([^']*)'/);
        if (m) return { n: 1, l: m[1] };
        return { n: null, l: '' };
    };

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
                    onClick={() => setShowPaste((s) => !s)}
                >
                    <span style={{ marginRight: '4px' }}>📝</span>
                    <ResponsiveText desktop={t('paste_phrases', 'Paste phrases')} mobile={t('paste', 'Paste')} />
                </Button>
            </Stack>

            <Collapse in={showPaste} timeout="auto" unmountOnExit>
                <Box mt={1} p={1} sx={{ border: '1px solid #444', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {t('paste_instructions', 'Paste lines in the format: categories;phrase;translation. The first line can be the header defining the separator.')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
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
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                fullWidth
                                multiline
                                minRows={4}
                                maxRows={16}
                                placeholder={t('paste_placeholder', 'categories;phrase;translation\nA;hello;hi')}
                                value={pasteText}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPasteText(val);
                                    // simple client-side preview parse
                                    try {
                                        const lines = val.split(/\r?\n/).filter(l => l.trim());
                                        if (!lines.length) { setPreviewRows([]); setPreviewError(''); return; }
                                        const first = lines[0].replace(/^\uFEFF/, '');
                                        const sep = (separator === 'auto') ? ([';', ',', '|', '\t'].find(d => first.includes(d)) || ';') : (separator === 'tab' ? '\t' : separator);
                                        const hasHeader = /^(categories|category)\s*\Q${sep}\E\s*phrase\s*\Q${sep}\E\s*translation$/i.test(first);
                                        const dataLines = hasHeader ? lines.slice(1) : lines;
                                        const parsed = dataLines.slice(0, 5).map(l => l.split(sep));
                                        // basic validation
                                        const bad = parsed.find(p => p.length < 3 || p.slice(0,3).some(x => !String(x).trim()));
                                        setPreviewRows(parsed.map(p => p.slice(0,3)));
                                        setPreviewError(bad ? t('operation_failed', 'Invalid row detected') : '');
                                    } catch (e) {
                                        setPreviewRows([]);
                                        setPreviewError(t('operation_failed', 'Preview failed'));
                                    }
                                }}
                                size="small"
                            />
                            {previewRows.length > 0 && (
                                <Box mt={1} sx={{ fontSize: 12, color: previewError ? 'error.main' : 'text.secondary' }}>
                                    <div><b>{t('show', 'Show')}:</b> {t('categories', 'Categories')} | {t('phrase', 'Phrase')} | {t('translation', 'Translation')}</div>
                                    {previewRows.map((r, i) => (
                                        <div key={i}>{(r[0]||'').toString()} | {(r[1]||'').toString()} | {(r[2]||'').toString()}</div>
                                    ))}
                                    {previewError && <div>{previewError}</div>}
                                </Box>
                            )}
                        </Box>
                        <Box>
                            <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                disabled={loading || !pasteText.trim()}
                                onClick={async () => {
                                    setNotification((n) => ({ ...n, open: false }));
                                    if (!ensureLanguageSetSelected()) return;
                                    if (!pasteText.trim()) return;
                                    setLoading(true);
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
                                        const res = await axios.post(url, payload, { headers });
                                        setNotification({
                                            open: true,
                                            message: res.data.message || t('upload_successful', 'Upload successful'),
                                            severity: 'success',
                                            autoHideDuration: 3000,
                                        });
                                        setServerSummary(res.data.message || '');
                                        setServerErrorLineNum(null);
                                        setServerErrorLine('');
                                        setPasteText('');
                                        onUpload();
                                    } catch (err) {
                                        let msg = t('upload_failed', 'Upload failed');
                                        if (err.response && err.response.data) {
                                            const d = err.response.data;
                                            msg = d.message || d.detail || d.error || msg;
                                            // Prefer structured fields if present
                                            if (d.first_error_line_num != null || d.first_error_line) {
                                                setServerErrorLineNum(d.first_error_line_num ?? null);
                                                setServerErrorLine(d.first_error_line ?? '');
                                            } else {
                                                const { n, l } = extractLineInfo(msg);
                                                setServerErrorLineNum(n);
                                                setServerErrorLine(l);
                                            }
                                        }
                                        setNotification({ open: true, message: msg, severity: 'error', autoHideDuration: null });
                                        setServerSummary(msg);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            >
                                {t('upload_paste', 'Upload pasted')}
                            </Button>
                        </Box>
                    </Stack>
                    {(serverSummary || serverErrorLineNum || serverErrorLine) && (
                        <Box mt={1} sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {serverSummary && <div>{serverSummary}</div>}
                            {serverErrorLineNum != null && (
                                <div style={{ marginTop: 4 }}>
                                    <b>Line:</b> {serverErrorLineNum}
                                </div>
                            )}
                            {serverErrorLine && (
                                <Box mt={0.5} sx={{
                                    bgcolor: 'background.paper',
                                    border: '1px dashed #666',
                                    borderRadius: 1,
                                    p: 1,
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {serverErrorLine}
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Collapse>
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