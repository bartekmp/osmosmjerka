import React from 'react';
import { Container, Box, Chip, Avatar } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import AdminButton from '../ui/AdminButton';
import { SPACING } from '../../utils/responsive';

/**
 * AdminLayout - A reusable layout component for admin pages
 * 
 * @param {ReactNode} children - Content to render in the layout
 * @param {boolean} showBackToGame - Whether to show "Back to Game" button
 * @param {boolean} showDashboard - Whether to show "Dashboard" button  
 * @param {boolean} showLogout - Whether to show "Logout" button
 * @param {Function} onDashboard - Handler for dashboard button click
 * @param {Function} onLogout - Handler for logout button click
 * @param {string} maxWidth - Container max width (default: 'xl')
 */
const AdminLayout = ({
  children,
  showBackToGame = true,
  showDashboard = false,
  showLogout = false,
  onDashboard,
  onLogout,
  maxWidth = 'xl',
  currentUser = null
}) => {
  const { t } = useTranslation();
  const username = currentUser?.username?.trim();
  const theme = useTheme();
  const isCompactLogout = useMediaQuery(theme.breakpoints.down('sm'));

  const logoutButtonSx = {
    bgcolor: '#FACC15',
    color: '#111827',
    '&:hover': {
      bgcolor: '#DC2626',
      color: '#F9FAFB'
    },
    ...(isCompactLogout
      ? {
          width: 'auto',
          minWidth: 64,
          px: 1.25,
          height: 40,
          fontSize: '0.85rem'
        }
      : {
          minWidth: 120,
          px: 2,
          fontSize: '0.95rem'
        })
  };

  return (
    <Container maxWidth={maxWidth} sx={{ py: 4 }}>
      {/* Add spacing below top controls */}
      <Box sx={{ height: SPACING.adminControlsTop }} />
      
      {/* Navigation bar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        gap: 2
      }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {showBackToGame && (
            <AdminButton
              to="/"
              desktopText={`🎮 ${t('back_to_game')}`}
              tabletText={t('game_short', 'Game')}
              mobileText="🎮"
            />
          )}
          {showDashboard && (
            <AdminButton
              onClick={onDashboard}
              desktopText={`🛠️ ${t('dashboard')}`}
              tabletText={t('dashboard_short', 'Admin')}
              mobileText="🛠️"
            />
          )}
        </Box>
        
        {showLogout && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {username && (
              <Chip
                label={username}
                variant="outlined"
                avatar={(
                  <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 28, height: 28, fontSize: '1rem' }}>
                    👤
                  </Avatar>
                )}
                sx={{
                  height: 36,
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  letterSpacing: '0.02em'
                }}
              />
            )}
            <AdminButton
              onClick={onLogout}
              color="secondary"
              desktopText={`🚪 ${t('logout')}`}
              mobileText="🚪"
              sx={logoutButtonSx}
            />
          </Box>
        )}
      </Box>
      
      {children}
    </Container>
  );
};

export default AdminLayout;
