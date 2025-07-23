import React from 'react';
import { Box, Button, TextField, Typography, Paper, Stack } from '@mui/material';

export default function EditRowForm({ editRow, setEditRow, handleSave }) {
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
                {editRow.id ? "Edit Row" : "Add Row"}
            </Typography>
            <Stack spacing={2}>
                <TextField
                    label="Categories"
                    value={editRow.categories}
                    onChange={e => setEditRow({ ...editRow, categories: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <TextField
                    label="Word"
                    value={editRow.word}
                    onChange={e => setEditRow({ ...editRow, word: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <TextField
                    label="Translation"
                    value={editRow.translation}
                    onChange={e => setEditRow({ ...editRow, translation: e.target.value })}
                    fullWidth
                    variant="outlined"
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                    <Button 
                        variant="contained" 
                        onClick={handleSave}
                        color="primary"
                    >
                        💾 Save
                    </Button>
                    <Button 
                        variant="outlined" 
                        onClick={() => setEditRow(null)}
                        color="secondary"
                    >
                        ❌ Cancel
                    </Button>
                </Box>
            </Stack>
        </Paper>
    );
}