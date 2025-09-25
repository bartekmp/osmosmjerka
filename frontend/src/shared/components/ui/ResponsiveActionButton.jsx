import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import ResponsiveText from './ResponsiveText';

/**
 * ResponsiveActionButton - A button component with responsive text and loading states
 * 
 * @param {string} desktopText - Text to show on desktop
 * @param {string} mobileText - Text/icon to show on mobile  
 * @param {boolean} loading - Whether to show loading spinner
 * @param {string} icon - Icon to prepend to text
 * @param {Function} onClick - Click handler
 * @param {string} variant - MUI Button variant
 * @param {string} color - MUI Button color
 * @param {string} size - MUI Button size
 * @param {Object} sx - Additional styles
 * @param {Object} ...props - Additional Button props
 */
const ResponsiveActionButton = ({
  desktopText,
  mobileText = null,
  loading = false,
  icon = null,
  onClick,
  variant = 'contained',
  color = undefined,
  size = 'small',
  fullWidth = true,
  sx = {},
  ...props
}) => {
  return (
    <Button
      fullWidth={fullWidth}
      onClick={onClick}
      variant={variant}
      color={color}
      size={size}
      disabled={loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
      sx={sx}
      {...props}
    >
      {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
      <ResponsiveText 
        desktop={desktopText} 
        mobile={mobileText} 
      />
    </Button>
  );
};

export default ResponsiveActionButton;
