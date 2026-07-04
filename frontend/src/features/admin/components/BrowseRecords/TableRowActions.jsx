import React from 'react';
import { Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useTranslation } from 'react-i18next';
import { installedVoiceForLang, speak } from '../../../../hooks/localTts';

export default function TableRowActions({
    row,
    onEdit,
    onDelete,
    targetLang = null,
    ttsEnabled = false
}) {
    const { t } = useTranslation();

    // Speak the phrase with the language set's in-browser voice. Shown only when a voice
    // for the target language is installed (kept in the cheap localStorage mirror).
    const voiceId = ttsEnabled && targetLang ? installedVoiceForLang(targetLang) : null;

    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {voiceId && (
                <Button
                    size="small"
                    onClick={() => speak(row.phrase, voiceId)}
                    aria-label={t('review.listen', 'Listen')}
                    title={t('review.listen', 'Listen')}
                    sx={{ minWidth: 0, width: 36, height: 36, fontSize: '1.1rem', lineHeight: 1 }}
                >
                    <VolumeUpIcon fontSize="small" />
                </Button>
            )}
            <Button
                size="small"
                onClick={() => onEdit(row)}
                aria-label={t('edit')}
                title={t('edit')}
                sx={{ minWidth: 0, width: 36, height: 36, fontSize: '1.1rem', lineHeight: 1 }}
            >
                <EditIcon fontSize="small" />
            </Button>
            <Button
                size="small"
                onClick={() => onDelete(row)}
                color="error"
                aria-label={t('delete')}
                title={t('delete')}
                sx={{ minWidth: 0, width: 36, height: 36, fontSize: '1.1rem', lineHeight: 1 }}
            >
                <DeleteIcon fontSize="small" />
            </Button>
        </Box>
    );
}
