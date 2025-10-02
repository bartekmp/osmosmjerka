/**
 * Styled Components
 * Reusable styled MUI components to replace common sx prop patterns
 * 
 * Benefits:
 * - Better performance (no sx prop recalculation)
 * - Type safety
 * - Reusability across components
 * - Easier to maintain and test
 */

import { styled } from '@mui/material/styles';
import { Box, Paper, Container, Typography, Button } from '@mui/material';

/**
 * Container Components
 */

// Centered container with vertical padding
export const PaddedContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

// Full height centered container
export const CenteredContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

/**
 * Box Components
 */

// Flex box with centered content
export const CenteredBox = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

// Flex box with space-between layout
export const SpaceBetweenBox = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

// Flex box with column layout and gap
export const StackBox = styled(Box)(({ theme, gap = 2 }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(gap),
}));

// Right-aligned box
export const RightAlignedBox = styled(Box)(({ theme }) => ({
  textAlign: 'right',
  marginBottom: theme.spacing(2),
}));

/**
 * Paper Components
 */

// Standard paper with padding and rounded corners
export const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: theme.spacing(2),
}));

// Compact paper with less padding
export const CompactPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(1),
}));

// Mini paper for small cards
export const MiniPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));

/**
 * Message/Alert Boxes
 */

// Error message box
export const ErrorBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.error.light,
  borderRadius: theme.spacing(1),
  color: theme.palette.error.contrastText,
}));

// Warning message box
export const WarningBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.warning.light,
  borderRadius: theme.spacing(1),
  color: theme.palette.warning.contrastText,
}));

// Success message box
export const SuccessBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.success.light,
  borderRadius: theme.spacing(1),
  color: theme.palette.success.contrastText,
}));

// Info message box
export const InfoBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.info.light,
  borderRadius: theme.spacing(1),
  color: theme.palette.info.contrastText,
}));

/**
 * Specialized Components
 */

// Section header box
export const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
}));

// Section with gap between items
export const SectionContent = styled(Box)(({ theme, spacing = 4 }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(spacing),
}));

// Icon wrapper for consistent sizing
export const IconWrapper = styled(Box)(({ _, size = 28 }) => ({
  width: size,
  height: size,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: size * 0.6,
}));

/**
 * Form Components
 */

// Form container with top margin
export const FormBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

// Form section with bottom margin
export const FormSection = styled(Box)(({ theme, marginBottom = 2 }) => ({
  marginBottom: theme.spacing(marginBottom),
}));

/**
 * Grid Components
 */

// Grid wrapper with padding
export const GridWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
}));

// No puzzle available box
export const NoPuzzleBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
}));

/**
 * Typography Components
 */

// Bold heading
export const BoldHeading = styled(Typography)(({ _ }) => ({
  fontWeight: 600,
}));

// Caption with margin
export const CaptionText = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  display: 'block',
  marginBottom: theme.spacing(0.5),
}));

// Secondary color text
export const SecondaryText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

/**
 * Responsive Components
 */

// Hide on mobile
export const HideOnMobile = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

// Hide on desktop
export const HideOnDesktop = styled(Box)(({ theme }) => ({
  [theme.breakpoints.up('sm')]: {
    display: 'none',
  },
}));

// Show only on tablet and up
export const TabletUp = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

/**
 * Admin-specific Components
 */

// Admin controls wrapper
export const AdminControlsBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
}));

// Admin actions box with flex-end
export const AdminActionsBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}));

// Divider box for admin sections
export const AdminDivider = styled(Box)(({ theme }) => ({
  height: 20,
  width: 1,
  backgroundColor: theme.palette.divider,
}));

/**
 * Dialog Components
 */

// Dialog content with bottom margin
export const DialogSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

// Dialog heading box
export const DialogHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

/**
 * Utility Components
 */

// Scrollable container
export const ScrollableBox = styled(Box)({
  overflowY: 'auto',
  overflowX: 'hidden',
});

// Full width box
export const FullWidthBox = styled(Box)({
  width: '100%',
});

// Clickable box with hover effect
export const ClickableBox = styled(Box)(({ theme }) => ({
  cursor: 'pointer',
  transition: theme.transitions.create(['background-color', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:active': {
    transform: 'scale(0.98)',
  },
}));

// Relative positioned box (for absolute children)
export const RelativeBox = styled(Box)({
  position: 'relative',
});

// Absolute positioned box
export const AbsoluteBox = styled(Box)({
  position: 'absolute',
});

/**
 * Layout Components
 */

// Main content area with max width
export const MainContent = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: theme.spacing(150), // 1200px
  margin: '0 auto',
}));

// Sidebar container
export const Sidebar = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 320,
  [theme.breakpoints.down('md')]: {
    maxWidth: '100%',
  },
}));

// Two-column layout
export const TwoColumnLayout = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(3),
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
}));

/**
 * Card Components
 */

// Stat card with gradient background
export const StatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, rgba(144, 202, 249, 0.05) 0%, rgba(144, 202, 249, 0.02) 100%)'
    : 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
  border: `1px solid ${theme.palette.mode === 'dark'
    ? 'rgba(144, 202, 249, 0.2)'
    : 'rgba(25, 118, 210, 0.2)'}`,
}));

// Hover card with elevation change
export const HoverCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  cursor: 'pointer',
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    boxShadow: theme.shadows[8],
    transform: 'translateY(-2px)',
  },
}));

/**
 * Export all components
 */
export {
  // Also re-export commonly used MUI components for convenience
  Box,
  Paper,
  Container,
  Typography,
  Button,
};
