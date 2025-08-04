import React from 'react';
import { Typography } from '@mui/material';

/**
 * Helper function to render text with click-to-expand functionality
 * @param {string} text - The text content to display
 * @param {string} columnName - The name of the column (for translation)
 * @param {function} t - Translation function
 * @param {function} openTextDialog - Function to open the text dialog
 * @param {number} maxLength - Maximum length before truncating
 * @returns {React.ReactNode}
 */
export const renderExpandableText = (text, columnName, t, openTextDialog, maxLength = 50) => {
    if (!text || text.length <= maxLength) {
        return text;
    }
    const truncated = text.substring(0, maxLength) + '...';
    return (
        <Typography
            component="span"
            sx={{
                cursor: 'pointer',
                color: 'primary.main',
                textDecoration: 'underline',
                '&:hover': {
                    color: 'primary.dark'
                }
            }}
            onClick={() => openTextDialog(t(columnName), text)}
            title={t('click_to_view_full_text')}
        >
            {truncated}
        </Typography>
    );
};
