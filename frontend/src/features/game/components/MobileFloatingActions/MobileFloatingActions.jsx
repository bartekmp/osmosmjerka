import React from 'react';
import { Button, Badge, Tooltip, useTheme } from '@mui/material';
import ListIcon from '@mui/icons-material/List';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
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
  isProgressiveMode = false,
  gameType = "word_search",
  currentHintLevel = 0
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = theme.palette.scrabble;

  // Match the desktop hint button color logic: secondary for progressive mode, primary otherwise
  const hintButtonColor = isProgressiveMode ? 'secondary' : 'primary';

  // Build button styles from the shared scrabble palette tokens (theme.palette.scrabble)
  // so the look stays in sync with the global MuiButton override.
  const getScrabbleButtonStyles = (color, isHintButton = false) => {
    const isSecondary = color === 'secondary';

    const getBackground = () => {
      if (isHintButton) return s.hint.gradient;
      if (isSecondary) return theme.palette.secondary.main;
      return s.main;
    };
    const getHoverBackground = () => {
      if (isHintButton) return s.hint.gradientHover;
      return s.hover;
    };
    const getActiveBackground = () => {
      if (isHintButton) return s.hint.gradientActive;
      if (isSecondary) return theme.palette.secondary.dark || s.active;
      return s.active;
    };

    return {
      minWidth: '48px',
      width: '48px',
      height: '48px',
      padding: 0,
      borderRadius: '12px',
      border: `2px solid ${s.border}`,
      boxShadow: s.boxShadow,
      background: getBackground(),
      color: isHintButton ? '#fff' : s.text,
      fontFamily: '"Arial Black", Arial, sans-serif',
      fontWeight: 'bold',
      transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
      '&:hover': {
        background: getHoverBackground(),
        boxShadow: s.boxShadow,
      },
      '&:active': {
        background: getActiveBackground(),
        boxShadow: `0 1px 0 ${s.border} inset`,
        transform: 'translateY(2px)',
      },
      '&.Mui-disabled': {
        background: s.disabled.background,
        color: s.disabled.text,
        borderColor: s.disabled.border,
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
          title={(() => {
            if (remainingHints <= 0) return t('no_hints_remaining');

            if (isProgressiveMode && gameType === "crossword") {
              const keys = ['crossword.hint_next_letter', 'crossword.hint_validate', 'crossword.hint_reveal'];
              const key = keys[currentHintLevel] || 'hint';
              return t(key) + ` (${t('hints_remaining', { count: remainingHints })})`;
            }

            return t('hint');
          })()}
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

