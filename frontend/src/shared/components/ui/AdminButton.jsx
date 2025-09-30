import React from 'react';
import { Button } from '@mui/material';
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
      justifyContent: 'center',
      ...sx
    },
    ...props
  };

  const content = (
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
