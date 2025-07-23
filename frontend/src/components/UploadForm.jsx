import React from 'react';
import axios from 'axios';
import { useRef, useState } from 'react';
import { Button, Box, Typography } from '@mui/material';

export default function UploadForm({ onUpload }) {
    const fileInputRef = useRef();
    const [error, setError] = useState("");

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        setError("");
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);

        // Get token from localStorage
        const token = localStorage.getItem('adminToken');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};

        try {
            await axios.post("/admin/upload", formData, { headers });
            onUpload();
        } catch (err) {
            if (err.response && err.response.data && err.response.data.detail) {
                setError(err.response.data.detail);
            } else {
                setError("Upload failed.");
            }
        }
        e.target.value = ""; // allows selecting the same file again
    };

    return (
        <Box sx={{ width: '100%' }}>
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
            >
                <span style={{ marginRight: '4px' }}>📁</span>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    Upload Words
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                    Upload
                </Box>
            </Button>
            {error && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
}