import React from 'react';
import { Button, Badge, Tooltip, useTheme } from '@mui/material';
import ListIcon from '@mui/icons-material/List';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from 'react-i18next';
import './MobileFloatingActions.css';

/**
 * Floating Action Buttons for mobile layout
 * Provides quick access to phrase list and hints
 * Styled as scrabble-style rounded rectangle buttons
 */
const MobileFloatingActions = ({
  onPhraseListClick,
  onHintClick,
  phrasesFound = 0,
  remainingHints = 0,
  showHintButton = true,
  disabled = false,
  isProgressiveMode = false
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Match the desktop hint button color logic: secondary for progressive mode, primary otherwise
  const hintButtonColor = isProgressiveMode ? 'secondary' : 'primary';

  // Get scrabble button colors from theme
  const getScrabbleButtonStyles = (color, isHintButton = false) => {
    const isPrimary = color === 'primary';
    const isSecondary = color === 'secondary';

    // Hint button uses gradient, others use solid colors
    const getBackground = () => {
      if (isHintButton) {
        return 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)';
      }
      if (isPrimary) {
        return isDarkMode ? '#4a4a4a' : '#f9e7b3';
      }
      if (isSecondary) {
        return theme.palette.secondary.main;
      }
      return isDarkMode ? '#4a4a4a' : '#f9e7b3';
    };

    const getHoverBackground = () => {
      if (isHintButton) {
        return 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)';
      }
      if (isPrimary) {
        return isDarkMode ? '#5a5a5a' : '#f0d99a';
      }
      if (isSecondary) {
        return isDarkMode ? '#7a6b4a' : '#f0d99a';
      }
      return isDarkMode ? '#5a5a5a' : '#f0d99a';
    };

    const getActiveBackground = () => {
      if (isHintButton) {
        return 'linear-gradient(135deg, #7b1fa2 0%, #512da8 100%)';
      }
      if (isPrimary) {
        return isDarkMode ? '#6b5b3a' : '#e6c97a';
      }
      if (isSecondary) {
        return theme.palette.secondary.dark || (isDarkMode ? '#5a4a2a' : '#d4b86a');
      }
      return isDarkMode ? '#6b5b3a' : '#e6c97a';
    };

    return {
      minWidth: '48px',
      width: '48px',
      height: '48px',
      padding: 0,
      borderRadius: '12px',
      border: `2px solid ${isDarkMode ? '#6b5b3a' : '#b89c4e'}`,
      boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
      background: getBackground(),
      color: isHintButton ? '#fff' : (isDarkMode ? '#e0e0e0' : '#333'),
      fontFamily: '"Arial Black", Arial, sans-serif',
      fontWeight: 'bold',
      transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
      '&:hover': {
        background: getHoverBackground(),
        boxShadow: `1px 2px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'}, 0 1px 0 ${isDarkMode ? '#5a5a5a' : '#fff'} inset`,
      },
      '&:active': {
        background: getActiveBackground(),
        boxShadow: `0 1px 0 ${isDarkMode ? '#6b5b3a' : '#b89c4e'} inset`,
        transform: 'translateY(2px)',
      },
      '&.Mui-disabled': {
        background: isDarkMode ? '#3a3a3a' : '#eee6c7',
        color: isDarkMode ? '#666' : '#aaa',
        borderColor: isDarkMode ? '#555' : '#d1c18a',
        boxShadow: 'none',
      },
    };
  };

  return (
    <div className="mobile-floating-actions">
      {/* Phrase List Button */}
      <Tooltip title={t('phrases_capitalized')} placement="top" arrow>
        <Badge
          badgeContent={phrasesFound}
          color="error"
          max={99}
          showZero={false}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Button
            variant="contained"
            aria-label={t('show_phrases')}
            onClick={onPhraseListClick}
            className="mobile-fab mobile-fab-phrases"
            sx={getScrabbleButtonStyles('primary')}
          >
            <ListIcon />
          </Button>
        </Badge>
      </Tooltip>

      {/* Hint Button - only show when hints are enabled */}
      {showHintButton && (
        <Tooltip
          title={remainingHints > 0 ? t('hint') : t('no_hints_remaining')}
          placement="top"
          arrow
        >
          <span>
            <Badge
              badgeContent={remainingHints}
              color="error"
              max={99}
              showZero={false}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <Button
                variant="contained"
                aria-label={t('hint')}
                onClick={onHintClick}
                disabled={disabled || remainingHints <= 0}
                className="mobile-fab mobile-fab-hint"
                sx={getScrabbleButtonStyles(hintButtonColor, true)}
              >
                {remainingHints > 0 ? <FlashOnIcon /> : <HelpOutlineIcon />}
              </Button>
            </Badge>
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default MobileFloatingActions;

