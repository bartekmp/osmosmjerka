import React from 'react';
import { Box, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { SearchOff, Category } from '@mui/icons-material';
import TableEmptyState from './TableEmptyState';

/**
 * TableNoRowsOverlay - Shows an overlay with empty state when table has no data
 * 
 * @param {Object} props
 * @param {boolean} props.isEmpty - Whether the table is empty
 * @param {boolean} props.isLoading - Whether data is currently being loaded
 * @param {string} props.searchTerm - Current search term (if any)
 * @param {Function} props.onClearSearch - Function to clear the search
 * @param {Object} props.translationFn - Translation function (i18n)
 */
export default function TableNoRowsOverlay({
    isEmpty,
    isLoading = false,
    searchTerm,
    onClearSearch,
    translationFn
}) {
    const theme = useTheme();
    const t = translationFn;

    // Don't show overlay if loading or if not empty
    if (isLoading || !isEmpty) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.2)'
                    : 'rgba(0, 0, 0, 0.05)',
                zIndex: 20,
                borderRadius: 1,
            }}
        >
            <Box
                sx={{
                    maxWidth: '400px',
                    width: '100%',
                    textAlign: 'center',
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: theme.palette.mode === 'dark'
                        ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                        : '0 4px 12px rgba(0, 0, 0, 0.15)',
                    p: 3
                }}
            >
                <TableEmptyState
                    title={searchTerm ? t('no_rows_found') : t('category_empty')}
                    message={searchTerm
                        ? t('try_different_search_terms')
                        : t('no_phrases_in_selected_category')
                    }
                    icon={searchTerm
                        ? <SearchOff sx={{ fontSize: 40 }} />
                        : <Category sx={{ fontSize: 40 }} />
                    }
                    sx={{ boxShadow: 'none', border: 'none' }}
                />

                {searchTerm && (
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onClearSearch}
                        sx={{
                            mt: 2,
                            borderColor: '#b89c4e',
                            color: '#b89c4e',
                            '&:hover': {
                                borderColor: '#8a7429',
                                backgroundColor: 'rgba(184, 156, 78, 0.04)'
                            }
                        }}
                    >
                        {t('clear_search')}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
