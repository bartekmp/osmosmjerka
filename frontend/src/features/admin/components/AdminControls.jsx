import React from 'react';
import { Box } from '@mui/material';
import { LanguageSwitcher, NightModeButton } from '../../../shared';

const AdminControls = () => {
    return (
        <>
            <Box className="admin-controls">
                <LanguageSwitcher className="control-button language-switcher" />
                <NightModeButton className="control-button night-mode" />
            </Box>
            {/* Add vertical spacing between controls row and content */}
            <Box className="admin-controls-spacer" />
        </>
    );
};

export default AdminControls;
