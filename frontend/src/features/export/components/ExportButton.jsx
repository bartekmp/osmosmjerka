import logger from '@shared/utils/logger';
import React, { useState } from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ExportModal from './ExportModal';
import { useTranslation } from 'react-i18next';

export default function ExportButton({ category, grid, phrases, gameType = 'word_search', disabled, className, sx }) {
    const [modalOpen, setModalOpen] = useState(false);
    const { t } = useTranslation();

    const handleExport = async (format) => {
        try {
            const response = await axios.post(
                "/api/export",
                {
                    category,
                    grid,
                    phrases,
                    format,
                    game_type: gameType,
                    across_label: t('crossword.across'),
                    down_label: t('crossword.down'),
                },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const puzzleLabel = t(gameType === 'crossword' ? 'gameType.crossword' : 'wordsearch');
            const safeCategory = (category || puzzleLabel).replace(/[^a-z0-9]+/gi, "_").toLowerCase();

            // Determine file extension based on format
            const extensions = {
                'docx': 'docx',
                'png': 'png'
            };
            const extension = extensions[format] || 'docx';

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${puzzleLabel}-${safeCategory}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            logger.error(t('export_failed'), err);
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
                className={`scrabble-btn ${className || ''}`}
                onClick={handleButtonClick}
                disabled={disabled}
                aria-label={t('export')}
                sx={sx}
            >
                <FileDownloadIcon fontSize="small" />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
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
