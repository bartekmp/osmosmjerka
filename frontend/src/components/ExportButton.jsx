import React from 'react';
import axios from 'axios';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import './ExportButton.css';

export default function ExportButton({ category, grid, words, disabled }) {
    const handleExport = async () => {
        try {
            const response = await axios.post("/api/export", { category, grid, words }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const safeCategory = (category || "wordsearch").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `wordsearch-${safeCategory}.docx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
        }
    };
    return (
        <Button 
            className="scrabble-btn export-btn" 
            onClick={handleExport} 
            disabled={disabled}
            sx={{ 
                height: { xs: 48, sm: 'auto' },
                minWidth: { xs: 48, sm: 'auto' },
                fontSize: { xs: '1.2rem', sm: '1rem' },
                px: { xs: 1, sm: 2 },
                py: { xs: 0, sm: 1 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: 0, sm: 1 }
            }}
        >
            <span>📄</span>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Export
            </Box>
        </Button>
    );
}
