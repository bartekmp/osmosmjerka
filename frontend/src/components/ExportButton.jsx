import React, { useState } from 'react';
import axios from 'axios';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ExportModal from './ExportModal';
import './ExportButton.css';
import { useTranslation } from 'react-i18next';

export default function ExportButton({ category, grid, words, disabled }) {
    const [modalOpen, setModalOpen] = useState(false);
    const { t } = useTranslation();

    const handleExport = async (format) => {
        try {
            const response = await axios.post(
                "/api/export",
                { category, grid, words, format },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const safeCategory = (category || t('wordsearch')).replace(/[^a-z0-9]+/gi, "_").toLowerCase();

            // Determine file extension based on format
            const extensions = {
                'docx': 'docx',
                'pdf': 'pdf',
                'png': 'png'
            };
            const extension = extensions[format] || 'docx';

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${t('wordsearch')}-${safeCategory}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(t('export_failed'), err);
        }
    };

    const handleButtonClick = () => {
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
    };

    const handleFormatSelect = (format) => {
        handleExport(format);
    };

    return (
        <>
            <Button
                className="scrabble-btn export-btn"
                onClick={handleButtonClick}
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
                    {t('export')}
                </Box>
            </Button>

            <ExportModal
                open={modalOpen}
                onClose={handleModalClose}
                onFormatSelect={handleFormatSelect}
            />
        </>
    );
}
