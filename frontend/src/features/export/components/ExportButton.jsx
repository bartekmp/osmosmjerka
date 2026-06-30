import React, { useState } from 'react';
import axios from 'axios';
import Button from '@mui/material/Button';
import ExportModal from './ExportModal';
import { useTranslation } from 'react-i18next';
import { ResponsiveText } from '../../../shared';

export default function ExportButton({ category, grid, phrases, disabled, className, sx }) {
    const [modalOpen, setModalOpen] = useState(false);
    const { t } = useTranslation();

    const handleExport = async (format) => {
        try {
            const response = await axios.post(
                "/api/export",
                { category, grid, phrases, format },
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const safeCategory = (category || t('wordsearch')).replace(/[^a-z0-9]+/gi, "_").toLowerCase();

            // Determine file extension based on format
            const extensions = {
                'docx': 'docx',
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
                className={`scrabble-btn ${className || ''}`}
                onClick={handleButtonClick}
                disabled={disabled}
                sx={sx}
            >
                <ResponsiveText desktop={'📥 ' + t('export')} mobile="📥" />
            </Button>

            <ExportModal
                open={modalOpen}
                onClose={handleModalClose}
                onFormatSelect={handleFormatSelect}
            />
        </>
    );
}
