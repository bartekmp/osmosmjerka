import axios from 'axios';
import { useRef } from 'react';

export default function UploadForm({ onUpload }) {
    const fileInputRef = useRef();

    const handleButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        await axios.post("/api/upload", formData);
        onUpload();
        e.target.value = ""; // allows selecting the same file again
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <button className="scrabble-btn" type="button" onClick={handleButtonClick}>
                Upload Words
            </button>
        </>
    );
}