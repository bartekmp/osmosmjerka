import React from 'react';
import axios from 'axios';

export default function ExportButton({ category, grid, words }) {
  const handleExport = async () => {
    const response = await axios.post("/api/export", { category, grid, words }, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wordsearch.docx');
    document.body.appendChild(link);
    link.click();
  };
  return <button onClick={handleExport}>Export to DOCX</button>;
}
