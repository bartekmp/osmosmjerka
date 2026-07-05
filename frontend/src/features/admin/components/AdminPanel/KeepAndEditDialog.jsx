import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Stack,
    Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Resolve a duplicate group by keeping ONE phrase (with edits) and deleting the rest.
 * Pre-fills the kept phrase's fields and surfaces the other duplicates' translations/categories
 * so the admin can combine them (e.g. two synonym translations) before saving.
 */
export default function KeepAndEditDialog({ open, onClose, keepPhrase, otherPhrases = [], onSave, saving = false }) {
    const { t } = useTranslation();
    const [phrase, setPhrase] = useState('');
    const [translation, setTranslation] = useState('');
    const [categories, setCategories] = useState('');

    useEffect(() => {
        if (open && keepPhrase) {
            setPhrase(keepPhrase.phrase || '');
            setTranslation(keepPhrase.translation || '');
            setCategories(keepPhrase.categories || '');
        }
    }, [open, keepPhrase]);

    // Append a translation, joined with "; ", skipping empties/exact duplicates already present.
    const appendTranslation = (text) => {
        const add = (text || '').trim();
        if (!add) return;
        setTranslation((cur) => {
            const parts = cur.split(/\s*;\s*|\n/).map((s) => s.trim()).filter(Boolean);
            if (parts.includes(add)) return cur;
            return parts.length ? `${parts.join('; ')}; ${add}` : add;
        });
    };

    const appendAll = () => otherPhrases.forEach((p) => appendTranslation(p.translation));

    const canSave = phrase.trim() && translation.trim() && !saving;

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('keep_edit_title', 'Keep & edit this phrase')}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label={t('phrase', 'Phrase')}
                        value={phrase}
                        onChange={(e) => setPhrase(e.target.value)}
                        fullWidth
                        size="small"
                    />
                    <TextField
                        label={t('translation', 'Translation')}
                        value={translation}
                        onChange={(e) => setTranslation(e.target.value)}
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                    />
                    <TextField
                        label={t('categories', 'Categories')}
                        value={categories}
                        onChange={(e) => setCategories(e.target.value)}
                        fullWidth
                        size="small"
                        helperText={t('categories_space_separated', 'Space-separated')}
                    />

                    {otherPhrases.length > 0 && (
                        <>
                            <Divider />
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="subtitle2">
                                        {t('other_duplicates_deleted', 'Other duplicates (will be deleted)')}
                                    </Typography>
                                    <Button size="small" onClick={appendAll}>
                                        {t('append_all_translations', 'Append all translations')}
                                    </Button>
                                </Box>
                                <Stack spacing={0.5}>
                                    {otherPhrases.map((p) => (
                                        <Box
                                            key={p.id}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}
                                        >
                                            <Typography variant="body2" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {p.translation}
                                                {p.categories ? (
                                                    <Typography component="span" variant="caption" color="text.secondary">
                                                        {' '}({p.categories})
                                                    </Typography>
                                                ) : null}
                                            </Typography>
                                            <Button size="small" onClick={() => appendTranslation(p.translation)} sx={{ flexShrink: 0 }}>
                                                {t('append_translation', '+ translation')}
                                            </Button>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    {t('cancel', 'Cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={() => onSave({ phrase: phrase.trim(), translation: translation.trim(), categories: categories.trim() })}
                    disabled={!canSave}
                >
                    {t('save_and_keep', 'Save & keep this')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
