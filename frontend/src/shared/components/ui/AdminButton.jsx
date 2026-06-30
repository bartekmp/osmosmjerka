import React from 'react';
import { Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import ResponsiveText from './ResponsiveText';
import { RESPONSIVE_BUTTON_STYLES } from '../../utils/responsive';

/**
 * AdminButton - A reusable button component for admin interfaces
 * 
 * @param {string} desktopText - Text to show on desktop
 * @param {string} mobileText - Text/icon to show on mobile
 * @param {string} to - Link destination (if provided, renders as Link)
 * @param {Function} onClick - Click handler
 * @param {string} variant - MUI Button variant
 * @param {string} color - MUI Button color
 * @param {Object} sx - Additional styles
 * @param {Object} ...props - Additional Button props
 */
const AdminButton = ({
  icon = null,
  desktopText,
  tabletText = null,
  mobileText = null,
  to = null,
  onClick,
  variant = 'outlined',
  color = undefined,
  sx = {},
  ...props
}) => {
  const buttonProps = {
    onClick,
    variant,
    color,
    sx: {
      ...RESPONSIVE_BUTTON_STYLES.admin,
      width: { xs: '100%', sm: 'auto' },
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: icon ? 0.75 : 0,
      ...sx
    },
    ...props
  };

  // When an icon is provided, show it on all sizes and keep the text label for
  // larger screens only (icon-only on mobile). Otherwise fall back to the
  // responsive text behaviour.
  const content = icon ? (
    <>
      {icon}
      {desktopText && (
        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
          {desktopText}
        </Box>
      )}
    </>
  ) : (
    <ResponsiveText
      desktop={desktopText}
      tablet={tabletText}
      mobile={mobileText}
    />
  );

  if (to) {
    return (
      <Button component={Link} to={to} {...buttonProps}>
        {content}
      </Button>
    );
  }

  return (
    <Button {...buttonProps}>
      {content}
    </Button>
  );
};

export default AdminButton;
