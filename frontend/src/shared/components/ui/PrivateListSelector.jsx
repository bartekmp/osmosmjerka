import React, { useState, useEffect, useCallback } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Box, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { STORAGE_KEYS } from '../../constants/constants';

const PrivateListSelector = ({
    selectedListId,
    onListChange,
    currentUser,
    languageSetId,
    disabled = false,
    size = 'small',
    variant = 'outlined',
}) => {
    const { t } = useTranslation();
    const [privateLists, setPrivateLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPrivateLists = useCallback(async () => {
        if (!currentUser || !languageSetId) {
            setPrivateLists([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
            if (!token) {
                setPrivateLists([]);
                return;
            }

            const response = await axios.get(
                `/api/user/private-lists?language_set_id=${languageSetId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            setPrivateLists(response.data || []);
        } catch (err) {
            console.error('Failed to fetch private lists:', err);
            setError(t('myLists.loading_failed', 'Failed to load your lists'));
            setPrivateLists([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser, languageSetId, t]);

    useEffect(() => {
        fetchPrivateLists();
    }, [fetchPrivateLists]);

    const handleChange = (event) => {
        const value = event.target.value;
        // Empty string means "Public Categories" (no private list selected)
        onListChange(value === '' ? null : parseInt(value));
    };

    // Don't render if user is not logged in
    if (!currentUser) {
        return null;
    }

    if (loading) {
        return (
            <FormControl variant={variant} size={size} disabled fullWidth>
                <InputLabel>{t('myLists.title', 'My Lists')}</InputLabel>
                <Select value="" displayEmpty>
                    <MenuItem value="">
                        <Typography variant="body2" color="textSecondary">
                            {t('loading', 'Loading...')}
                        </Typography>
                    </MenuItem>
                </Select>
            </FormControl>
        );
    }

    if (error) {
        return (
            <Box sx={{ minWidth: 120 }}>
                <Typography variant="body2" color="error" fontSize="small">
                    {error}
                </Typography>
            </Box>
        );
    }

    const value = selectedListId !== null ? selectedListId.toString() : '';

    return (
        <FormControl variant={variant} size={size} disabled={disabled || !languageSetId} fullWidth>
            <InputLabel>{t('myLists.title', 'My Lists')}</InputLabel>
            <Select
                value={value}
                label={t('myLists.title', 'My Lists')}
                onChange={handleChange}
                displayEmpty
            >
                {/* Public Categories option (default) */}
                <MenuItem value="">
                    <em>{t('myLists.public_categories', 'Public Categories')}</em>
                </MenuItem>
                
                {privateLists.length > 0 && (
                    <>
                        <Divider />
                        {privateLists.map((list) => (
                            <MenuItem key={list.id} value={list.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {list.is_system_list && '📝 '}
                                    {list.list_name}
                                    {list.phrase_count > 0 && (
                                        <Typography 
                                            variant="caption" 
                                            color="text.secondary"
                                            sx={{ ml: 'auto' }}
                                        >
                                            ({list.phrase_count})
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        ))}
                    </>
                )}
                
                {privateLists.length === 0 && (
                    <MenuItem disabled>
                        <Typography variant="body2" color="textSecondary">
                            {t('myLists.no_lists_yet', 'No lists yet. Add phrases to get started!')}
                        </Typography>
                    </MenuItem>
                )}
            </Select>
        </FormControl>
    );
};

export default PrivateListSelector;
