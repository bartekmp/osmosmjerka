import React, { useState, useEffect, useCallback } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Box, Typography, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { STORAGE_KEYS } from '../../constants/constants';

const PrivateListSelector = ({
    selectedListId,
    onListChange = () => { },
    currentUser,
    languageSetId,
    disabled = false,
    size = 'small',
    variant = 'outlined',
}) => {
    const { t } = useTranslation();
    const [privateLists, setPrivateLists] = useState([]);
    const [sharedLists, setSharedLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPrivateLists = useCallback(async () => {
        if (!currentUser || !languageSetId) {
            setPrivateLists([]);
            setSharedLists([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
            if (!token) {
                setPrivateLists([]);
                setSharedLists([]);
                return;
            }

            // Fetch both private lists and shared lists
            const [privateResponse, sharedResponse] = await Promise.all([
                axios.get(
                    `/api/user/private-lists?language_set_id=${languageSetId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                ).catch((err) => {
                    console.error('Failed to fetch private lists:', err);
                    return { data: { lists: [] } };
                }),
                axios.get(
                    `/api/user/shared-lists?language_set_id=${languageSetId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                ).catch((err) => {
                    console.error('Failed to fetch shared lists:', err);
                    return { data: { lists: [] } };
                })
            ]);

            const privateListsData = privateResponse.data?.lists || privateResponse.data || [];
            const sharedListsData = sharedResponse.data?.lists || sharedResponse.data || [];
            setPrivateLists(privateListsData);
            setSharedLists(sharedListsData);
        } catch (err) {
            console.error('Failed to fetch lists:', err);
            setError(t('myLists.loading_failed', 'Failed to load your lists'));
            setPrivateLists([]);
            setSharedLists([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser, languageSetId, t]);

    // Separate effect to validate selectedListId after lists are loaded
    useEffect(() => {
        if (!loading && !error && selectedListId !== null) {
            const allIds = [
                ...privateLists.map(l => l.id),
                ...sharedLists.map(l => l.id)
            ];
            if (!allIds.includes(selectedListId) && typeof onListChange === 'function') {
                // Selected list no longer exists, notify parent
                onListChange(null);
            }
        }
    }, [loading, error, privateLists, sharedLists, selectedListId, onListChange]);

    useEffect(() => {
        fetchPrivateLists();
    }, [fetchPrivateLists]);

    const handleChange = (event) => {
        const value = event.target.value;
        // Empty string means "Public Categories" (no private list selected)
        const listId = value === '' || value === null || value === undefined ? null : parseInt(String(value), 10);
        if (value !== '' && value !== null && value !== undefined && isNaN(listId)) {
            return;
        }
        onListChange(listId);
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

    // Ensure the value matches an available option, or use empty string
    // Check if selectedListId exists in the available lists
    // Only check if lists are loaded (not loading and no error)
    const allListIds = !loading && !error ? [
        ...privateLists.map(l => String(l.id)),
        ...sharedLists.map(l => String(l.id))
    ] : [];
    const value = selectedListId !== null && allListIds.includes(String(selectedListId))
        ? String(selectedListId)
        : '';

    // Find the selected list to display its name
    const _ = selectedListId !== null
        ? [...privateLists, ...sharedLists].find(l => l.id === selectedListId)
        : null;

    return (
        <FormControl variant={variant} size={size} disabled={disabled || !languageSetId} fullWidth>
            <InputLabel id="private-list-select-label" shrink={true}>
                {t('myLists.title', 'My Lists')}
            </InputLabel>
            <Select
                labelId="private-list-select-label"
                value={value}
                label={t('myLists.title', 'My Lists')}
                onChange={handleChange}
                displayEmpty
                disabled={disabled || !languageSetId}
                renderValue={(selectedValue) => {
                    if (!selectedValue || selectedValue === '') {
                        return <em>{t('myLists.public_categories', 'Public Categories')}</em>;
                    }
                    // Find the list and return its name
                    const list = [...privateLists, ...sharedLists].find(l => String(l.id) === selectedValue);
                    if (list) {
                        const prefix = list.is_system_list ? '📝 ' : '';
                        const ownerPrefix = sharedLists.some(sl => sl.id === list.id)
                            ? `👤 ${list.owner_username || 'Unknown'}: `
                            : '';
                        return `${prefix}${ownerPrefix}${list.list_name}`;
                    }
                    return selectedValue;
                }}
            >
                {/* Build menu items as an array to avoid Fragment issues with MUI Select */}
                {[
                    // Public Categories option (default)
                    <MenuItem
                        key="public"
                        value=""
                        onClick={(e) => {
                            e.stopPropagation();
                            const syntheticEvent = {
                                target: { value: '' }
                            };
                            handleChange(syntheticEvent);
                        }}
                    >
                        <em>{t('myLists.public_categories', 'Public Categories')}</em>
                    </MenuItem>,

                    // Private lists section
                    ...(privateLists.length > 0 ? [
                        <Divider key="divider-private" />,
                        ...privateLists.map((list) => (
                            <MenuItem
                                key={list.id}
                                value={String(list.id)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const syntheticEvent = {
                                        target: { value: String(list.id) }
                                    };
                                    handleChange(syntheticEvent);
                                }}
                            >
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
                        ))
                    ] : []),

                    // Shared lists section
                    ...(sharedLists.length > 0 ? [
                        <Divider key="divider-shared" />,
                        <MenuItem key="shared-header" disabled>
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {t('myLists.shared_with_me', 'Shared with me')}
                            </Typography>
                        </MenuItem>,
                        ...sharedLists.map((list) => (
                            <MenuItem
                                key={`shared-${list.id}`}
                                value={String(list.id)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const syntheticEvent = {
                                        target: { value: String(list.id) }
                                    };
                                    handleChange(syntheticEvent);
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                        👤 {list.owner_username || 'Unknown'}:
                                    </Typography>
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
                        ))
                    ] : []),

                    // No lists message
                    ...(privateLists.length === 0 && sharedLists.length === 0 ? [
                        <MenuItem key="no-lists" disabled>
                            <Typography variant="body2" color="textSecondary">
                                {t('myLists.no_lists_yet', 'No private lists yet')}
                            </Typography>
                        </MenuItem>
                    ] : [])
                ]}
            </Select>
        </FormControl>
    );
};

export default PrivateListSelector;
