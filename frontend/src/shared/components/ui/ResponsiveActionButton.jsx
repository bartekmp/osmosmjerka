import React from 'react';
import { Button, CircularProgress, Tooltip, Box } from '@mui/material';
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
  compact = false,
  ariaLabel,
  forceMobileText = false,
  tooltip,
  sx = {},
  ...props
}) => {
  const { ['aria-label']: ariaLabelProp, ...otherProps } = props;
  const compactStyles = compact
    ? {
        minWidth: 48,
        width: 48,
        height: 48,
        padding: 0,
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : {};

  const baseSx = compact
    ? {}
    : {
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
        justifyContent: 'center',
        px: { xs: 1.25, sm: 1.5, md: 2 },
        flex: '0 0 auto',
        flexShrink: 0,
        ...(fullWidth ? {} : { width: 'auto' }),
        '& .MuiButton-startIcon': {
          marginLeft: 0,
          marginRight: 0.75
        }
      };
  const combinedSx = compact
    ? { ...(sx || {}), ...compactStyles }
    : { ...baseSx, ...(sx || {}) };
  const computedLabel = ariaLabel
    || ariaLabelProp
    || (forceMobileText && mobileText)
    || desktopText
    || mobileText;
  const startIcon = !compact && loading ? <CircularProgress size={20} color="inherit" /> : null;
  const renderLabelContent = () => {
    if (compact) {
      if (loading) {
        return <CircularProgress size={20} color="inherit" />;
      }
      const glyph = icon || (mobileText || desktopText || '').charAt(0) || '•';
      return (
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            lineHeight: 1,
            fontSize: '1.2rem',
            overflow: 'hidden'
          }}
        >
          {glyph}
        </Box>
      );
    }

    const labelText = forceMobileText && mobileText
      ? (
        <Box component="span" sx={{ whiteSpace: 'nowrap', lineHeight: 1 }}>
          {mobileText}
        </Box>
      )
      : (
        <ResponsiveText
          desktop={desktopText}
          mobile={mobileText}
          component={Box}
          sx={{ whiteSpace: 'nowrap', lineHeight: 1 }}
        />
      );

    return (
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: icon ? 0.75 : 0.5,
          whiteSpace: 'nowrap',
          lineHeight: 1.1
        }}
      >
        {icon && (
          <Box component="span" aria-hidden sx={{ lineHeight: 1 }}>
            {icon}
          </Box>
        )}
        {labelText}
      </Box>
    );
  };

  const button = (
    <Button
      fullWidth={fullWidth}
      onClick={onClick}
      variant={variant}
      color={color}
      size={size}
      disabled={loading}
      startIcon={startIcon}
      sx={combinedSx}
      aria-label={computedLabel}
      {...otherProps}
    >
      {renderLabelContent()}
    </Button>
  );

  if (!compact) {
    return button;
  }

  const tooltipTitle = tooltip || desktopText || mobileText || computedLabel || '';

  return (
    <Tooltip title={tooltipTitle} placement="bottom" enterDelay={200}>
      <span
        style={{
          display: fullWidth ? 'flex' : 'inline-flex',
          width: fullWidth ? '100%' : 'auto'
        }}
      >
        {button}
      </span>
    </Tooltip>
  );
};

export default ResponsiveActionButton;
