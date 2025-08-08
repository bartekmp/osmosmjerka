import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * NotEnoughPhrasesOverlay
 * Local (container-scoped) overlay showing a message when there aren't enough phrases.
 */
const NotEnoughPhrasesOverlay = ({ show, message, isDarkMode }) => {
  const { t } = useTranslation();
  if (!show) return null;

  const themeClass = isDarkMode ? 'dark' : 'light';

  return (
    <Box className={`not-enough-phrases-overlay ${themeClass}`}>
      <Box className={`not-enough-phrases-content ${themeClass}`}>
        {message || t('not_enough_phrases')}
      </Box>
    </Box>
  );
};

export default NotEnoughPhrasesOverlay;
