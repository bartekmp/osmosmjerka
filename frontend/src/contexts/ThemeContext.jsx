import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { STORAGE_KEYS } from '../shared/constants/constants';

import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const useThemeMode = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeMode must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const { t: _t } = useTranslation(); // For possible future use in theme toggling UI
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.THEME);
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDarkMode));
        // Update body data attribute for CSS theming
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

ThemeProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
