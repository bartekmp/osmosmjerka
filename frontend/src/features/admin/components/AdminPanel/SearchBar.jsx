import React, { useState, useEffect, useCallback } from 'react';
import {
    TextField,
    InputAdornment,
    IconButton,
    CircularProgress
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';

export default function SearchBar({ 
    value = '', 
    onChange, 
    debounceTime = 300,
    placeholder,
    fullWidth = false,
    size = "small"
}) {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState(value);
    const [isSearching, setIsSearching] = useState(false);
    
    // Update local value if external value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    // Debounce search term changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSearch = useCallback(
        debounce((searchValue) => {
            if (searchValue !== value) {
                onChange(searchValue);
                setTimeout(() => {
                    setIsSearching(false);
                }, 300);
            }
        }, debounceTime),
        [onChange, value, debounceTime]
    );

    const handleSearchChange = (newValue) => {
        setLocalValue(newValue);
        setIsSearching(true);
        debouncedSearch(newValue);
    };

    const handleClearSearch = () => {
        setLocalValue('');
        setIsSearching(false);
        onChange('');
    };

    return (
        <TextField
            size={size}
            placeholder={placeholder || t('search')}
            value={localValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            fullWidth={fullWidth}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        {isSearching ? (
                            <CircularProgress size={16} sx={{ color: '#b89c4e' }} />
                        ) : (
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                        )}
                    </InputAdornment>
                ),
                endAdornment: localValue && (
                    <InputAdornment position="end">
                        <IconButton
                            size="small"
                            onClick={handleClearSearch}
                            edge="end"
                            sx={{ 
                                color: 'text.secondary',
                                '&:hover': {
                                    color: '#b89c4e'
                                }
                            }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </InputAdornment>
                ),
                sx: {
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                    '&:hover': {
                        backgroundColor: 'background.default'
                    }
                }
            }}
            sx={{
                minWidth: { xs: '100%', sm: '250px' },
                maxWidth: { xs: '100%', sm: '350px' },
                '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                        borderColor: '#b89c4e',
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: '#b89c4e',
                    },
                }
            }}
        />
    );
}
