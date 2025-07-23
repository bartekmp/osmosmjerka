import React from 'react';
import axios from 'axios';
import Button from '@mui/material/Button';
import './ExportButton.css';

export default function ExportButton({ category, grid, words }) {
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
        <Button className="scrabble-btn export-btn" onClick={handleExport} sx={{ width: '100%', py: 2, fontSize: '1.2rem' }}>
            <span style={{ marginRight: 8 }}>📄</span>
            <span style={{ display: 'none', sm: 'inline' }}>Export to DOCX</span>
            <span style={{ display: 'inline', sm: 'none' }}>Export</span>
        </Button>
    );
}
