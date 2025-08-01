import React from 'react';
import { Container, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AdminButton from './AdminButton';
import { SPACING } from '../utils/responsive';

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
  maxWidth = 'xl'
}) => {
  const { t } = useTranslation();

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
              desktopText={`⇇ ${t('back_to_game')}`}
              mobileText="🏠"
            />
          )}
          {showDashboard && (
            <AdminButton
              onClick={onDashboard}
              desktopText={`← ${t('dashboard')}`}
              mobileText="⬅️"
            />
          )}
        </Box>
        
        {showLogout && (
          <AdminButton
            onClick={onLogout}
            color="secondary"
            desktopText={t('logout')}
            mobileText="🚪"
          />
        )}
      </Box>
      
      {children}
    </Container>
  );
};

export default AdminLayout;
