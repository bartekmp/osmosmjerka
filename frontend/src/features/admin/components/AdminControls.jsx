import React from 'react';
import { Box } from '@mui/material';
import { LanguageSwitcher, NightModeButton } from '../../../shared';

const AdminControls = () => {
    return (
        <>
            <Box className="admin-controls">
                <LanguageSwitcher className="control-button language-switcher" sx={{
                    minWidth: { xs: 36, sm: 44, md: 48 },
                    height: { xs: 36, sm: 44, md: 48 },
                    minHeight: { xs: 36, sm: 44, md: 48 },
                }} />
                <NightModeButton className="control-button night-mode" sx={{
                    minWidth: { xs: 36, sm: 44, md: 48 },
                    height: { xs: 36, sm: 44, md: 48 },
                    minHeight: { xs: 36, sm: 44, md: 48 },
                    padding: { xs: 0.5, sm: 0.75, md: 1 },
                }} />
            </Box>
            {/* Add vertical spacing between controls row and content */}
            <Box className="admin-controls-spacer" />
        </>
    );
};

export default AdminControls;
