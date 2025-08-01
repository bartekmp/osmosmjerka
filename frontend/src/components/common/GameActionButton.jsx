import React from 'react';
import { Button } from '@mui/material';
import ResponsiveText from './ResponsiveText';
import { getResponsiveButtonSize } from '../utils/responsive';

/**
 * GameActionButton - A responsive button for game actions
 * 
 * @param {string} icon - Icon/emoji to display
 * @param {string} desktopText - Text to show on desktop
 * @param {string} mobileText - Text to show on mobile (optional)
 * @param {Function} onClick - Click handler
 * @param {string} title - Button title/tooltip
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} size - Button size ('small', 'medium')
 * @param {Object} sx - Additional styles
 * @param {Object} ...props - Additional Button props
 */
const GameActionButton = ({
  icon,
  desktopText,
  mobileText = null,
  onClick,
  title,
  disabled = false,
  size = 'medium',
  sx = {},
  ...props
}) => {
  const responsiveStyles = getResponsiveButtonSize(size);
  
  return (
    <Button
      onClick={onClick}
      title={title}
      disabled={disabled}
      sx={{
        ...responsiveStyles,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: { xs: '1.2rem', sm: '2rem' },
        px: { xs: 1, sm: 2 },
        ...sx
      }}
      {...props}
    >
      <span>{icon}</span>
      {(desktopText || mobileText) && (
        <ResponsiveText
          desktop={desktopText}
          mobile={mobileText}
          sx={{ fontSize: '1rem', mt: 1, display: { xs: 'none', sm: 'inline' } }}
        />
      )}
    </Button>
  );
};

export default GameActionButton;
