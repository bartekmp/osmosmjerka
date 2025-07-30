import React from 'react';
import {
    Modal,
    Box,
    Typography,
    Button,
    Stack,
    Fade,
    Backdrop
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function ExportModal({ open, onClose, onFormatSelect }) {
    const { t } = useTranslation();
    const modalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: 400 },
        bgcolor: 'background.paper',
        border: '2px solid #b89c4e',
        borderRadius: '7px',
        boxShadow: '2px 4px 12px rgba(0, 0, 0, 0.3)',
        p: 4,
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto'
    };

    const formatButtons = [
        { format: 'docx', label: t('word_document'), icon: '📄', description: t('word_document_desc') },
        { format: 'pdf', label: t('pdf_document'), icon: '📑', description: t('pdf_document_desc') },
        { format: 'png', label: t('png_image'), icon: '🖼️', description: t('png_image_desc') }
    ];

    const handleFormatClick = (format) => {
        onFormatSelect(format);
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{
                timeout: 300,
                sx: { backgroundColor: 'rgba(0, 0, 0, 0.6)' }
            }}
        >
            <Fade in={open} timeout={300}>
                <Box sx={modalStyle}>
                    <Typography
                        variant="h5"
                        component="h2"
                        gutterBottom
                        align="center"
                        sx={{
                            fontFamily: '"Arial Black", Arial, sans-serif',
                            fontWeight: 'bold',
                            mb: 3
                        }}
                    >
                        {t('choose_export_format')}
                    </Typography>

                    <Stack spacing={2} sx={{ mb: 3 }}>
                        {formatButtons.map(({ format, label, icon, description }) => (
                            <Button
                                key={format}
                                className="scrabble-btn"
                                onClick={() => handleFormatClick(format)}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                    py: 2,
                                    px: 3,
                                    height: 'auto',
                                    textTransform: 'none',
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                    }
                                }}
                            >
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold'
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                                    {label}
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: '0.85rem',
                                        opacity: 0.8,
                                        fontWeight: 'normal'
                                    }}
                                >
                                    {description}
                                </Typography>
                            </Button>
                        ))}
                    </Stack>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            onClick={onClose}
                            className="scrabble-btn"
                            sx={{
                                bgcolor: '#ff6b6b',
                                borderColor: '#d63031',
                                color: 'white',
                                '&:hover': {
                                    bgcolor: '#e55656',
                                    borderColor: '#b71c1c'
                                },
                                '&:active': {
                                    bgcolor: '#d63031',
                                    boxShadow: '0 1px 0 #b71c1c inset',
                                }
                            }}
                        >
                            ❌ {t('cancel')}
                        </Button>
                    </Box>
                </Box>
            </Fade>
        </Modal>
    );
}
