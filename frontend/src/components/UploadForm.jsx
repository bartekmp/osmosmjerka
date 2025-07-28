import React from 'react';
import axios from 'axios';
import { useRef, useState } from 'react';
import { Button, Box, Typography, CircularProgress, Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function UploadForm({ onUpload }) {
    const fileInputRef = useRef();
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success', // 'success' or 'error'
        autoHideDuration: 3000, // ms, only for success
    });

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleClose = () => setNotification((n) => ({ ...n, open: false }));

    const handleFileChange = async (e) => {
        setNotification((n) => ({ ...n, open: false }));
        setLoading(true);
        const file = e.target.files[0];
        if (!file) {
            setLoading(false);
            return;
        }
        const formData = new FormData();
        formData.append('file', file);

        // Get token from localStorage
        const token = localStorage.getItem('adminToken');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};

        try {
            const res = await axios.post("/admin/upload", formData, { headers });
            setNotification({
                open: true,
                message: res.data.message || 'Upload successful',
                severity: 'success',
                autoHideDuration: 3000,
            });
            onUpload();
        } catch (err) {
            let msg = 'Upload failed.';
            if (err.response && err.response.data && (err.response.data.message || err.response.data.detail)) {
                msg = err.response.data.message || err.response.data.detail;
            }
            setNotification({
                open: true,
                message: msg,
                severity: 'error',
                autoHideDuration: null,
            });
        } finally {
            setLoading(false);
            e.target.value = ""; // allows selecting the same file again
        }
    };

    return (
        <Box sx={{ width: '100%', position: 'relative' }}>
            <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <Button 
                fullWidth 
                variant="contained" 
                color="info" 
                onClick={handleButtonClick}
                size="small"
                disabled={loading}
            >
                <span style={{ marginRight: '4px' }}>📁</span>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    Upload Words
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    Upload
                </Box>
                {loading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Button>
            <Snackbar
                open={notification.open}
                autoHideDuration={notification.severity === 'success' ? notification.autoHideDuration : null}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    severity={notification.severity}
                    action={
                        <IconButton size="small" color="inherit" onClick={handleClose}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    }
                    onClose={handleClose}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}