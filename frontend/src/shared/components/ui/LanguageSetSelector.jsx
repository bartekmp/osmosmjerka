import React, { useState, useEffect, useRef } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_ENDPOINTS, STORAGE_KEYS } from '../../constants/constants';

const LanguageSetSelector = ({
    selectedLanguageSetId,
    onLanguageSetChange,
    disabled = false,
    size = 'small',
    variant = 'outlined',
    onStatusChange = null
}) => {
    const { t } = useTranslation();
    const [languageSets, setLanguageSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        const fetchLanguageSets = async () => {
            // Prevent duplicate API calls in StrictMode
            if (fetchedRef.current) return;
            fetchedRef.current = true;

            try {
                setLoading(true);
                if (onStatusChange) {
                    onStatusChange('pending');
                }
                const response = await axios.get(API_ENDPOINTS.LANGUAGE_SETS);
                setLanguageSets(response.data);
                if (onStatusChange) {
                    onStatusChange(response.data.length > 0 ? 'success' : 'empty');
                }
            } catch (err) {
                console.error('Failed to fetch language sets:', err);
                setError(t('language_set_loading_failed', 'Failed to load language sets'));
                if (onStatusChange) {
                    onStatusChange('error');
                }
                fetchedRef.current = false; // Reset on error to allow retry
            } finally {
                setLoading(false);
            }
        };

        fetchLanguageSets();
    }, [onStatusChange, t]);

    // Handle default selection in a separate effect
    useEffect(() => {
        if (languageSets.length > 0 && !selectedLanguageSetId) {
            const defaultSet = languageSets[0];
            onLanguageSetChange(defaultSet.id);
            // Save to localStorage for persistence
            localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, defaultSet.id.toString());
        }
    }, [languageSets, selectedLanguageSetId, onLanguageSetChange]);

    const handleChange = (event) => {
        const newLanguageSetId = parseInt(event.target.value);
        onLanguageSetChange(newLanguageSetId);
        // Save to localStorage for persistence
        localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, newLanguageSetId.toString());
    };

    if (loading) {
        return (
            <FormControl variant={variant} size={size} disabled>
                <InputLabel>{t('language_set', 'Language Set')}</InputLabel>
                <Select value="" displayEmpty>
                    <MenuItem value="">
                        <Typography variant="body2" color="textSecondary">
                            {t('language_set_loading', 'Loading...')}
                        </Typography>
                    </MenuItem>
                </Select>
            </FormControl>
        );
    }

    if (error) {
        return (
            <Box sx={{ minWidth: 120 }}>
                <Typography variant="body2" color="error">
                    {error}
                </Typography>
            </Box>
        );
    }

    if (languageSets.length === 0) {
        return (
            <Box sx={{ minWidth: 120 }}>
                <Typography variant="body2" color="textSecondary">
                    {t('no_language_sets_title', 'No language sets available')}
                </Typography>
            </Box>
        );
    }

    return (
        <FormControl variant={variant} size={size} disabled={disabled} sx={{ minWidth: 130 }}>
            <InputLabel id="language-set-select-label">
                {t('language_set', 'Language Set')}
            </InputLabel>
            <Select
                labelId="language-set-select-label"
                id="language-set-select"
                value={selectedLanguageSetId || ''}
                label={t('language_set', 'Language Set')}
                onChange={handleChange}
            >
                {languageSets.map((set) => (
                    <MenuItem key={set.id} value={set.id}>
                        <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {set.display_name}
                            </Typography>
                            {set.description && (
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                    {set.description}
                                </Typography>
                            )}
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default LanguageSetSelector;
