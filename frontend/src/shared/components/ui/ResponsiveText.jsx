import React from 'react';
import { Box } from '@mui/material';
import { RESPONSIVE_TEXT_DISPLAY } from '../../utils/responsive';

/**
 * ResponsiveText - A component that handles responsive text display patterns
 * 
 * @param {string} desktop - Text to show on desktop/large screens
 * @param {string} mobile - Text to show on mobile screens (optional)
 * @param {Object} component - MUI component to wrap text (default: Box)
 * @param {Object} sx - Additional sx styles
 * @param {Object} ...props - Additional props to pass to the wrapper component
 */
const ResponsiveText = ({ 
  desktop, 
  mobile = null, 
  component = Box, 
  sx = {},
  ...props 
}) => {
  const Component = component;
  
  if (!mobile) {
    return (
      <Component component="span" sx={sx} {...props}>
        {desktop}
      </Component>
    );
  }

  return (
    <>
      <Component 
        component="span" 
        sx={{ ...RESPONSIVE_TEXT_DISPLAY.hideOnMobile, ...sx }} 
        {...props}
      >
        {desktop}
      </Component>
      <Component 
        component="span" 
        sx={{ ...RESPONSIVE_TEXT_DISPLAY.hideOnDesktop, ...sx }} 
        {...props}
      >
        {mobile}
      </Component>
    </>
  );
};

export default ResponsiveText;
