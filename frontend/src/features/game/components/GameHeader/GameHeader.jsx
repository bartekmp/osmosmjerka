import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, NightModeButton } from '../../../../shared';
import { Link } from 'react-router-dom';
import { Button } from '@mui/material';

const GameHeader = ({ 
    logoFilter, 
    handleLogoClick, 
    showCelebration,
    isDarkMode 
}) => {
    const { t } = useTranslation();

    return (
        <Box className="game-header">
            {/* Logo and title - centered within available space */}
            <Box className="logo-title-container" onClick={handleLogoClick}>
                <Box className="logo-container">
                    <Box
                        component="img"
                        src="/android-chrome-512x512.png"
                        alt="Osmosmjerka logo"
                        className="logo-image"
                        style={{ filter: logoFilter }}
                        onError={e => { 
                            e.target.onerror = null; 
                            e.target.src = "/favicon-32x32.png"; 
                        }}
                    />
                </Box>
                <Typography
                    variant="h1"
                    className={`title-text ${showCelebration ? 'celebrating' : ''}`}
                >
                    Osmosmjerka
                </Typography>
            </Box>

            {/* Controls - positioned absolutely on the right */}
            <Box className="header-controls">
                <LanguageSwitcher className="control-button language-switcher" />
                <Button
                    component={Link}
                    to="/admin"
                    className="control-button profile"
                >
                    {t('profile')}
                </Button>
                <NightModeButton className="control-button night-mode" />
            </Box>
        </Box>
    );
};

export default GameHeader;
