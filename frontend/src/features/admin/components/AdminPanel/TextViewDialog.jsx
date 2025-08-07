import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Button,
    IconButton,
    Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export default function TextViewDialog({ 
    open, 
    title, 
    content, 
    onClose 
}) {
    const { t } = useTranslation();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: '80vh',
                    backgroundColor: 'background.paper'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                color: 'text.primary'
            }}>
                {title}
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <Box sx={{
                    backgroundColor: 'background.default',
                    borderRadius: 1,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Typography
                        variant="body1"
                        sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                            userSelect: 'text',
                            color: 'text.primary'
                        }}
                    >
                        {content}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions sx={{
                p: 2,
                backgroundColor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider'
            }}>
                <Button onClick={onClose} variant="contained">
                    {t('close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
