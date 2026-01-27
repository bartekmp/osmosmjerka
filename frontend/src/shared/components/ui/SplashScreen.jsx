import React from 'react';
import PropTypes from 'prop-types';
import { Box, CircularProgress, Fade, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { getAssetUrl } from '../../utils/assets';
import useLogoColor from '../../../hooks/useLogoColor';

const SplashScreen = ({
    open = false,
    message,
    messageKey = 'loading_game',
    isDarkMode = false,
    enterDuration = 250,
    exitDuration = 600
}) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const displayMessage = message ?? t(messageKey, { defaultValue: 'Loading Osmosmjerka...' });
    const { logoFilter, changeLogoColor } = useLogoColor();

    return (
        <Fade in={open} timeout={{ enter: enterDuration, exit: exitDuration }} unmountOnExit mountOnEnter>
            <Box
                role="presentation"
                sx={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: theme.zIndex.modal + 2,
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    pointerEvents: open ? 'auto' : 'none',
                }}
            >
                <Stack spacing={3} alignItems="center">
                    <Box
                        component="img"
                        src={getAssetUrl('android-chrome-512x512.png')}
                        alt="Osmosmjerka logo"
                        sx={{
                            width: { xs: 96, sm: 120 },
                            height: { xs: 96, sm: 120 },
                            filter: isDarkMode ? `drop-shadow(0 12px 24px rgba(0,0,0,0.55)) ${logoFilter}` : `drop-shadow(0 12px 24px rgba(0,0,0,0.25)) ${logoFilter}`,
                            userSelect: 'none',
                            cursor: 'pointer',
                            transition: 'filter 0.3s ease'
                        }}
                        onClick={changeLogoColor}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getAssetUrl('favicon-32x32.png');
                        }}
                    />
                    <CircularProgress
                        size={48}
                        thickness={4.2}
                        color={isDarkMode ? 'secondary' : 'primary'}
                        aria-label={displayMessage}
                    />
                    {displayMessage && (
                        <Typography
                            variant="h6"
                            align="center"
                            color={isDarkMode ? 'grey.200' : 'grey.800'}
                            sx={{ maxWidth: 320 }}
                        >
                            {displayMessage}
                        </Typography>
                    )}
                </Stack>
            </Box>
        </Fade>
    );
};

SplashScreen.propTypes = {
    open: PropTypes.bool,
    message: PropTypes.string,
    messageKey: PropTypes.string,
    isDarkMode: PropTypes.bool,
    enterDuration: PropTypes.number,
    exitDuration: PropTypes.number,
};

export default SplashScreen;
