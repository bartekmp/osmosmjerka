import React from 'react';
import axios from 'axios';

export default function UploadForm({ onUpload }) {
    const handleSubmit = async (e) => {
        e.preventDefault();
        const file = e.target.file.files[0];
        const formData = new FormData();
        formData.append("file", file);
        await axios.post("/api/upload", formData);
        onUpload();
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input type="file" name="file" accept=".txt,.csv" required />
            <button type="submit">Upload Words</button>
        </form>
    );
}