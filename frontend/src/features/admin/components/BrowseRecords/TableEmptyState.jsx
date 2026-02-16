import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * TableEmptyState - Displays a centered message when a table has no data
 * 
 * @param {Object} props
 * @param {string} props.title - Optional title to display
 * @param {string} props.message - The message to display
 * @param {React.ReactNode} props.icon - Optional icon to display above the message
 * @param {Object} props.sx - Optional styling overrides
 */
export default function TableEmptyState({ 
    title = null,
    message, 
    icon = null,
    sx = {}
}) {
    const theme = useTheme();

    return (
        <Box 
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                width: '100%',
                borderRadius: 1,
                backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.02)',
                border: '1px dashed',
                borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : 'rgba(0, 0, 0, 0.1)',
                color: 'text.secondary',
                ...sx
            }}
        >
            {icon && (
                <Box sx={{ mb: 2, color: 'text.secondary' }}>
                    {icon}
                </Box>
            )}
            
            {title && (
                <Typography 
                    variant="h6" 
                    color="text.primary" 
                    sx={{ mb: 1, fontWeight: 500 }}
                >
                    {title}
                </Typography>
            )}
            
            <Typography 
                variant="body1" 
                color="inherit"
                align="center"
            >
                {message}
            </Typography>
        </Box>
    );
}
