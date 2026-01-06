import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
    Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../../../contexts/ThemeContext';
import PreviewGrid, { PHRASE_COLORS_LIGHT, PHRASE_COLORS_DARK } from './PreviewGrid';

/**
 * PreviewDialog - Preview how a phrase set will appear to students
 */
function PreviewDialog({ open, onClose, phraseSet, token }) {
    const { t } = useTranslation();
    const { isDarkMode } = useThemeMode();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [grid, setGrid] = useState([]);
    const [phrases, setPhrases] = useState([]);
    const [containerSize, setContainerSize] = useState({ width: 400, height: 400 });

    const gridRef = useRef(null);
    const gridContainerRef = useRef(null);
    const colors = isDarkMode ? PHRASE_COLORS_DARK : PHRASE_COLORS_LIGHT;

    // Measure container size after render
    useEffect(() => {
        if (!open || loading) return;

        const measureContainer = () => {
            if (gridContainerRef.current) {
                const rect = gridContainerRef.current.getBoundingClientRect();
                // Use the actual available space, with some padding
                setContainerSize({
                    width: Math.max(200, rect.width - 16),
                    height: Math.max(200, rect.height - 16),
                });
            }
        };

        // Measure after layout settles
        const timer = setTimeout(measureContainer, 150);
        window.addEventListener('resize', measureContainer);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', measureContainer);
        };
    }, [open, loading, grid]);

    // Generate preview grid when dialog opens
    useEffect(() => {
        if (!open || !phraseSet) return;

        const generatePreview = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/admin/teacher/phrase-sets/${phraseSet.id}/preview`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                if (!response.ok) throw new Error(t('teacher.preview.error_generate', 'Failed to generate preview'));
                const data = await response.json();
                setGrid(data.grid || []);
                setPhrases(data.phrases || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        generatePreview();
    }, [open, phraseSet, token]);

    const handleClose = () => {
        setGrid([]);
        setPhrases([]);
        setError(null);
        onClose();
    };

    const handlePhraseClick = (phraseIndex) => {
        gridRef.current?.blinkPhrase(phraseIndex);
    };

    if (!phraseSet) return null;
    const config = phraseSet.config || {};

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    height: '85vh',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                }
            }}
        >
            <DialogTitle sx={{ flexShrink: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{t('teacher.preview.title', { name: phraseSet.name, defaultValue: 'Preview: {{name}}' })}</Typography>
                    <Alert severity="info" sx={{ py: 0 }}>{t('teacher.preview.click_hint', 'Click a phrase to highlight it')}</Alert>
                </Stack>
            </DialogTitle>

            <DialogContent
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    p: 2,
                    minHeight: 0, // Critical for flex children to shrink
                }}
            >
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 2,
                            flex: 1,
                            minHeight: 0,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Grid container */}
                        <Box
                            ref={gridContainerRef}
                            sx={{
                                flex: { xs: '1 1 50%', md: '1 1 auto' },
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                minHeight: 0,
                                minWidth: 0,
                                overflow: 'auto',
                            }}
                        >
                            <PreviewGrid
                                ref={gridRef}
                                grid={grid}
                                phrases={phrases}
                                isDarkMode={isDarkMode}
                                containerWidth={containerSize.width}
                                containerHeight={containerSize.height}
                            />
                        </Box>

                        {/* Settings + Phrase list */}
                        <Box
                            sx={{
                                width: { xs: '100%', md: 300 },
                                flex: { xs: '1 1 50%', md: '0 0 300px' },
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Settings */}
                            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, flexShrink: 0 }}>
                                <Typography variant="subtitle2" gutterBottom>{t('teacher.preview.settings', 'Settings')}</Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" label={`${config.grid_size || 10}×${config.grid_size || 10}`} variant="outlined" />
                                    <Chip size="small" label={config.allow_hints ? t('teacher.preview.hints_enabled', 'Hints ✓') : t('teacher.preview.hints_disabled', 'No hints')} color={config.allow_hints ? 'success' : 'default'} variant="outlined" />
                                    <Chip size="small" label={config.show_translations ? t('teacher.preview.translations_enabled', 'Translations ✓') : t('teacher.preview.translations_disabled', 'Hidden')} color={config.show_translations ? 'success' : 'default'} variant="outlined" />
                                    <Chip size="small" label={config.show_timer ? t('teacher.preview.timer_enabled', 'Timer ✓') : t('teacher.preview.timer_disabled', 'No timer')} color={config.show_timer ? 'success' : 'default'} variant="outlined" />
                                </Stack>
                            </Box>

                            {/* Phrase list header */}
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ flexShrink: 0, mb: 1 }}>
                                {t('teacher.preview.phrases_count', { count: phrases.length, defaultValue: 'Phrases ({{count}})' })}
                            </Typography>

                            {/* Scrollable phrase list */}
                            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                                {phrases.map((phrase, index) => (
                                    <Box
                                        key={index}
                                        onClick={() => handlePhraseClick(index)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 1,
                                            mb: 1,
                                            p: 1,
                                            borderRadius: 1,
                                            backgroundColor: 'action.hover',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            '&:hover': {
                                                backgroundColor: 'action.selected',
                                                transform: 'translateX(4px)',
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 22,
                                                height: 22,
                                                minWidth: 22,
                                                borderRadius: '3px',
                                                backgroundColor: colors[index % colors.length],
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: isDarkMode ? '#fff' : '#000',
                                                fontWeight: 'bold',
                                                fontSize: 11,
                                            }}
                                        >
                                            {index + 1}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight="medium" noWrap>{phrase.phrase}</Typography>
                                            {phrase.translation && (
                                                <Typography variant="caption" color="text.secondary" noWrap>→ {phrase.translation}</Typography>
                                            )}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ flexShrink: 0 }}>
                <Button onClick={handleClose} variant="contained">{t('teacher.preview.exit', 'Exit Preview')}</Button>
            </DialogActions>
        </Dialog>
    );
}

export default PreviewDialog;
