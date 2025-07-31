import { Typography } from '@mui/material';

export function measureTextWidth(text, fontSize = '14px', fontFamily = 'Roboto, sans-serif') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontSize} ${fontFamily}`;
    return context.measureText(text).width;
}

export function calculateMinColumnWidths(filteredRows, t) {
    if (!filteredRows || filteredRows.length === 0) return {};
    const minWidths = {};
    const cellMargin = 24; // 12px margin on each side for consistency
    const columnKeys = ['id', 'categories', 'word', 'translation'];
    columnKeys.forEach(key => {
        let maxWidth = 0;
        const headerText = key === 'id' ? 'ID' : t(key);
        const headerWidth = measureTextWidth(headerText, '14px', 'Roboto, sans-serif') + cellMargin;
        maxWidth = Math.max(maxWidth, headerWidth);
        filteredRows.forEach(row => {
            const cellText = String(row[key] || '');
            const textWidth = measureTextWidth(cellText, '14px', 'Roboto, sans-serif') + cellMargin;
            maxWidth = Math.max(maxWidth, textWidth);
        });
        minWidths[key] = Math.ceil(maxWidth);
    });
    // Actions column: fixed width to fit two buttons (60px each) + gaps + margins
    minWidths.actions = 140;
    return minWidths;
}

export async function copyToClipboard(text, setCopyFeedback, t) {
    setCopyFeedback('');
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            setCopyFeedback(t('copied_successfully'));
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                setCopyFeedback(t('copied_successfully'));
            } else {
                throw new Error('Fallback copy failed');
            }
        }
        setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        setCopyFeedback(t('copy_failed'));
        setTimeout(() => setCopyFeedback(''), 3000);
    }
}
