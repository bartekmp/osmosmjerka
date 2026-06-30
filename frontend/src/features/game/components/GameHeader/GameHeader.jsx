import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, NightModeButton, GameTypeSelector } from '../../../../shared';
import { Link } from 'react-router-dom';
import { Button } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { getAssetUrl } from '../../../../shared/utils/assets';

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
    const profileLabel = username || t('profile');

    return (
        <Box sx={{
            width: '100%',
            display: 'grid',
            // Mobile: [brand | controls]. Desktop (md+): [spacer | brand | controls]
            // with equal 1fr side columns so the brand is centered in the viewport.
            gridTemplateColumns: { xs: 'auto 1fr', md: '1fr auto 1fr' },
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            mt: 2,
            mb: 3, // Add bottom margin to prevent overlap with content below
            px: { xs: 1, sm: 2 },
            minHeight: { xs: 48, sm: 56, md: 64, lg: 72 } // Ensure minimum height
        }}>
            {/* Left spacer — present only on desktop to balance the controls column
                so the brand lands dead-center. */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* Brand: logo + wordmark grouped as one clickable unit.
                Left-aligned on mobile, centered on desktop. The wordmark hides below
                the sm breakpoint so the brand is logo-only on small screens. */}
            <Box
                sx={{
                    minWidth: 0,
                    justifySelf: { xs: 'start', md: 'center' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1, sm: 1.5 },
                    cursor: 'pointer',
                }}
                onClick={handleLogoClick}
            >
                <Box
                    component="img"
                    src={getAssetUrl("android-chrome-512x512.png")}
                    alt="Osmosmjerka logo"
                    sx={{
                        flexShrink: 0,
                        height: { xs: 30, sm: 32, md: 36, lg: 44 },
                        width: { xs: 30, sm: 32, md: 36, lg: 44 },
                        filter: logoFilter,
                        transition: 'filter 0.3s ease',
                        userSelect: 'none',
                    }}
                    onError={e => {
                        e.target.onerror = null;
                        e.target.src = getAssetUrl("favicon-32x32.png");
                    }}
                />
                <Typography
                    variant="h1"
                    sx={{
                        display: { xs: 'none', sm: 'block' }, // logo-only on small screens
                        fontSize: { sm: '1.5rem', md: '2rem', lg: '2.5rem' },
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
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

            {/* Controls (right) — pinned to the end of the row */}
            <Box
                sx={{
                    justifySelf: 'end',
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
                    title={profileLabel}
                    aria-label={profileLabel}
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
                    <AccountCircleIcon fontSize="small" />
                    <Box
                        component="span"
                        sx={{ display: { xs: 'none', md: 'inline' }, ml: 0.5 }}
                    >
                        {profileLabel}
                    </Box>
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
