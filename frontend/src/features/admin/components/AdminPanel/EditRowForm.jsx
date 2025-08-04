import React from 'react';
import { Box, Button, TextField, Typography, Paper, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function EditRowForm({ editRow, setEditRow, handleSave }) {
    const { t } = useTranslation();
    if (!editRow) return null;

    return (
        <Paper
            sx={{
                p: 3,
                mb: 3,
                maxWidth: 500,
                mx: 'auto',
                borderRadius: 2,
                boxShadow: 3
            }}
        >
            <Typography variant="h5" component="h3" gutterBottom align="center">
                {editRow.id ? t('edit_row') : t('add_row')}
            </Typography>
            <Stack spacing={2}>
                <TextField
                    label={t('categories')}
                    value={editRow.categories}
                    onChange={e => setEditRow({ ...editRow, categories: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <TextField
                    label={t('word')}
                    value={editRow.word}
                    onChange={e => setEditRow({ ...editRow, word: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <TextField
                    label={t('translation')}
                    value={editRow.translation}
                    onChange={e => setEditRow({ ...editRow, translation: e.target.value })}
                    fullWidth
                    variant="outlined"
                    multiline
                    minRows={2}
                    maxRows={6}
                    sx={{
                        '& .MuiInputBase-root': {
                            whiteSpace: 'pre-wrap'
                        }
                    }}
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        color="primary"
                    >
                        {t('save')}
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setEditRow(null)}
                        color="secondary"
                    >
                        {t('cancel')}
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}