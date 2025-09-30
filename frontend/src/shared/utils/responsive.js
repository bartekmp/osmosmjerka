/**
 * Responsive utility functions and constants for consistent styling
 */

// Common responsive patterns
export const RESPONSIVE_BUTTON_STYLES = {
  small: {
    minWidth: { xs: 36, sm: 44, md: 48 },
    height: { xs: 36, sm: 44, md: 48 },
    minHeight: { xs: 36, sm: 44, md: 48 }
  },
  medium: {
    minWidth: { xs: 48, sm: 56, md: 64 },
    height: { xs: 48, sm: 56, md: 64 },
    minHeight: { xs: 48, sm: 56, md: 64 }
  },
  admin: {
    height: 48,
    minWidth: 72,
    px: { xs: 1.5, md: 2.5 },
    fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
    maxWidth: { xs: 140, sm: 180, md: 'unset' },
    textTransform: 'none'
  }
};

// Common responsive text display patterns
export const RESPONSIVE_TEXT_DISPLAY = {
  hideOnMobile: {
    display: { xs: 'none', sm: 'inline' }
  },
  hideOnDesktop: {
    display: { xs: 'inline', sm: 'none' }
  },
  showAlways: {
    display: 'inline'
  }
};

// Common spacing patterns
export const SPACING = {
  adminControlsTop: { xs: 16, sm: 20 },
  controlGap: { xs: 1, sm: 1, md: 1 },
  buttonPadding: { xs: 0.5, sm: 0.75, md: 1 }
};

/**
 * Helper function to create responsive text components
 */
export const createResponsiveText = (desktopText, mobileText = null) => {
  if (!mobileText) {
    return desktopText;
  }
  
  return {
    desktop: { text: desktopText, style: RESPONSIVE_TEXT_DISPLAY.hideOnMobile },
    mobile: { text: mobileText, style: RESPONSIVE_TEXT_DISPLAY.hideOnDesktop }
  };
};

/**
 * Generate consistent admin navigation button props
 */
export const createAdminButtonProps = (onClick, variant = 'outlined', color = undefined) => ({
  onClick,
  variant,
  color,
  sx: RESPONSIVE_BUTTON_STYLES.admin
});

/**
 * Generate consistent responsive button sizing
 */
export const getResponsiveButtonSize = (size = 'small') => {
  return RESPONSIVE_BUTTON_STYLES[size] || RESPONSIVE_BUTTON_STYLES.small;
};
