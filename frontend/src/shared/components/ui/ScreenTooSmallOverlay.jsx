import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * ScreenTooSmallOverlay
 * Overlay showing a message when the screen is too small to display the game.
 */
const ScreenTooSmallOverlay = ({ show, isDarkMode, message }) => {
  const { t } = useTranslation();
  if (!show) return null;

  const themeClass = isDarkMode ? 'dark' : 'light';
  const displayMessage = message || t('screen_too_small');

  return (
    <Box className={`not-enough-phrases-overlay ${themeClass}`}>
      <Box className={`not-enough-phrases-content ${themeClass}`}>
        {displayMessage}
      </Box>
    </Box>
  );
};

export default ScreenTooSmallOverlay;

