/**
 * Style Constants
 * Centralized constants for breakpoints, dimensions, z-index scale, etc.
 * These match the CSS variables but are available for JavaScript usage.
 */

/**
 * Breakpoints (in pixels)
 * Use these for media queries and responsive logic
 */
export const BREAKPOINTS = {
  mobile: 600,
  tablet: 900,
  desktop: 1200,
};

/**
 * Layout Dimensions
 * Standard sizes used throughout the application
 */
export const LAYOUT = {
  sidebarWidth: 320,
  maxFormWidth: 480,
  controlsHeight: 64,
  maxContentWidth: 1200,
  adminControlsTop: 64, // Height of admin controls at top
};

/**
 * Z-Index Scale
 * Consistent layering throughout the application
 */
export const Z_INDEX = {
  dropdown: 50,
  sticky: 100,
  fixed: 200,
  overlay: 1000,
  modal: 1300,
  tooltip: 1500,
};

/**
 * Spacing Scale (in pixels)
 * Matches CSS variables for consistency
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Named spacing for specific use cases
  adminControlsTop: 64,
  gridPadding: 8,
  buttonMargin: 8,
};

/**
 * Border Radius (in pixels)
 */
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: '50%',
  scrabble: 7, // Specific to scrabble-style buttons
};

/**
 * Transition Durations (in milliseconds)
 */
export const TRANSITIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
};

/**
 * Grid Cell Colors
 * Can be used for dynamic styling or calculations
 */
export const GRID_COLORS = {
  light: {
    border: '#c7a24f',
    background: '#f2e8d6',
    highlight: '#fdf4e2',
    selected: '#cde8f6',
    found: '#e7ce8a',
  },
  dark: {
    border: '#6b5b3a',
    background: '#4a4a4a',
    highlight: '#5a5a5a',
    selected: '#2a4a5a',
    found: '#6b5b3a',
  },
};

/**
 * Theme Colors
 */
export const THEME_COLORS = {
  primaryGold: '#b89c4e',
  primaryGoldLight: '#f9e7b3',
  primaryGoldDark: '#8a7429',
  secondaryLight: '#e6c97a',
  secondaryDark: '#6b5b3a',
};

/**
 * Semantic Colors
 */
export const SEMANTIC_COLORS = {
  success: '#4caf50',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
};

/**
 * Media Query Helpers
 * Generate media query strings for responsive design
 */
export const mediaQueries = {
  mobile: `@media (max-width: ${BREAKPOINTS.mobile}px)`,
  tablet: `@media (max-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `@media (min-width: ${BREAKPOINTS.desktop}px)`,
  
  // Min-width queries
  mobileUp: `@media (min-width: ${BREAKPOINTS.mobile + 1}px)`,
  tabletUp: `@media (min-width: ${BREAKPOINTS.tablet + 1}px)`,
  desktopUp: `@media (min-width: ${BREAKPOINTS.desktop}px)`,
  
  // Range queries
  mobileOnly: `@media (max-width: ${BREAKPOINTS.mobile}px)`,
  tabletOnly: `@media (min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`,
  desktopOnly: `@media (min-width: ${BREAKPOINTS.tablet + 1}px)`,
};

/**
 * Grid Cell Sizes
 * Standard sizes for grid cells at different breakpoints
 */
export const GRID_CELL_SIZES = {
  desktop: {
    fontSize: '1.2em',
    minWidth: '2em',
    minHeight: '2em',
    padding: '4px',
  },
  tablet: {
    fontSize: '1em',
    minWidth: '2.2em',
    minHeight: '2.2em',
    padding: '0.15em',
  },
  mobile: {
    fontSize: '0.8em',
    minWidth: '1.7em',
    minHeight: '1.7em',
    padding: '0.1em',
  },
};

/**
 * Animation Easing Functions
 */
export const EASING = {
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
};

/**
 * Helper Functions
 */

/**
 * Convert spacing constant to pixels
 * @param {keyof SPACING} size - Spacing size key
 * @returns {string} Pixel value as string
 */
export const toPx = (size) => {
  const value = SPACING[size];
  return typeof value === 'number' ? `${value}px` : value;
};

/**
 * Check if viewport width is mobile
 * @returns {boolean}
 */
export const isMobile = () => {
  return typeof window !== 'undefined' && window.innerWidth <= BREAKPOINTS.mobile;
};

/**
 * Check if viewport width is tablet
 * @returns {boolean}
 */
export const isTablet = () => {
  return typeof window !== 'undefined' && 
    window.innerWidth > BREAKPOINTS.mobile && 
    window.innerWidth <= BREAKPOINTS.tablet;
};

/**
 * Check if viewport width is desktop
 * @returns {boolean}
 */
export const isDesktop = () => {
  return typeof window !== 'undefined' && window.innerWidth > BREAKPOINTS.tablet;
};
