import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, NightModeButton, GameTypeSelector } from '../../../../shared';
import { Link } from 'react-router-dom';
import { Button } from '@mui/material';
import { getAssetUrl } from '../../../../shared/utils/assets';
import ResponsiveText from '../../../../shared/components/ui/ResponsiveText';

const GameHeader = ({
    logoFilter,
    handleLogoClick,
    showCelebration,
    currentUser,
    gameType,
    onGameTypeChange,
    isGridLoading
}) => {
    const { t } = useTranslation();
    const username = currentUser?.username?.trim();
    const baseEmoji = '👤';
    const profileDesktopLabel = username ? `${baseEmoji} ${username}` : `${baseEmoji} ${t('profile')}`;
    const profileMobileLabel = baseEmoji;

    return (
        <Box sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            // Three regions: logo (left), title (flexible center), controls (right).
            // No absolute positioning or magic offsets — the layout self-corrects
            // if the control cluster changes size.
            gap: { xs: 1, sm: 2 },
            mt: 2,
            mb: 3, // Add bottom margin to prevent overlap with content below
            px: { xs: 1, sm: 2 },
            minHeight: { xs: 48, sm: 56, md: 64, lg: 72 } // Ensure minimum height
        }}>
            {/* Logo (left region) */}
            <Box
                sx={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    height: { xs: 30, sm: 32, md: 36, lg: 44 },
                    width: { xs: 30, sm: 32, md: 36, lg: 44 },
                }}
                onClick={handleLogoClick}
            >
                <Box
                    component="img"
                    src={getAssetUrl("android-chrome-512x512.png")}
                    alt="Osmosmjerka logo"
                    sx={{
                        height: '100%',
                        width: '100%',
                        filter: logoFilter,
                        transition: 'filter 0.3s ease',
                        userSelect: 'none',
                    }}
                    onError={e => {
                        e.target.onerror = null;
                        e.target.src = getAssetUrl("favicon-32x32.png");
                    }}
                />
            </Box>

            {/* Title (center region) - grows to fill, truncates gracefully */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                }}
                onClick={handleLogoClick}
            >
                <Typography
                    variant="h1"
                    sx={{
                        fontSize: { xs: '1.1rem', sm: '1.5rem', md: '2rem', lg: '2.5rem' }, // Reduced mobile font size
                        textAlign: 'center',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                        maxWidth: '100%',
                        '@media (max-width: 349px)': {
                            display: 'none',
                        },
                        // Add wobble animation when celebrating
                        animation: showCelebration ? 'title-wobble 0.5s ease-in-out 6' : 'none',
                        '@keyframes title-wobble': {
                            '0%, 100%': {
                                transform: 'rotate(0deg) scale(1)',
                            },
                            '25%': {
                                transform: 'rotate(-3deg) scale(1.05)',
                            },
                            '50%': {
                                transform: 'rotate(0deg) scale(1.1)',
                            },
                            '75%': {
                                transform: 'rotate(3deg) scale(1.05)',
                            },
                        }
                    }}
                >
                    Osmosmjerka
                </Typography>
            </Box>

            {/* Controls (right region) */}
            <Box
                sx={{
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: { xs: 1, sm: 1, md: 1 }, // Uniform gaps across all screen sizes
                }}
            >
                <LanguageSwitcher
                    sx={{
                        minWidth: { xs: 44, sm: 44, md: 48 },
                        height: { xs: 44, sm: 44, md: 48 },
                        minHeight: { xs: 44, sm: 44, md: 48 },
                    }}
                />
                {/* Game Type Selector */}
                {gameType && onGameTypeChange && (
                    <GameTypeSelector
                        currentType={gameType}
                        onChange={onGameTypeChange}
                        disabled={isGridLoading}
                        sx={{
                            minWidth: { xs: 44, sm: 44, md: 48 },
                            height: { xs: 44, sm: 44, md: 48 },
                        }}
                    />
                )}
                <Button
                    component={Link}
                    to="/admin"
                    title={profileDesktopLabel}
                    sx={{
                        display: 'flex', // Show on all screen sizes
                        minWidth: { xs: 44, sm: 44, md: 48 },
                        height: { xs: 44, sm: 44, md: 48 },
                        minHeight: { xs: 44, sm: 44, md: 48 },
                        fontSize: { sm: '0.8rem', md: '0.9rem' },
                        px: { xs: 0.5, sm: 0.75, md: 1 },
                        textTransform: 'none'
                    }}
                >
                    <ResponsiveText desktop={profileDesktopLabel} mobile={profileMobileLabel} />
                </Button>
                <NightModeButton
                    sx={{
                        minWidth: { xs: 44, sm: 44, md: 48 },
                        height: { xs: 44, sm: 44, md: 48 },
                        minHeight: { xs: 44, sm: 44, md: 48 },
                        padding: { xs: 0.5, sm: 0.75, md: 1 },
                    }}
                />
            </Box>
        </Box>
    );
};

export default GameHeader;
