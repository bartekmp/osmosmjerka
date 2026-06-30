import React from 'react';
import { Box, Typography, Button, Tooltip } from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useTranslation } from 'react-i18next';

const AllFoundMessage = ({
    allFound,
    _: _loadPuzzle,
    refreshPuzzle,
    selectedCategory,
    difficulty,
    canShowBreakdown = false,
    onShowBreakdown
}) => {
    const { t } = useTranslation();

    if (!allFound) return null;

    const showBreakdown = Boolean(allFound && canShowBreakdown);

    const handleBreakdownClick = () => {
        if (!showBreakdown) return;
        onShowBreakdown?.();
    };

    const handleBreakdownKeyDown = (event) => {
        if (!showBreakdown) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onShowBreakdown?.();
        }
    };

    return (
        <Box className="all-found-message">
            {showBreakdown ? (
                <Tooltip title={t('scoring_rules.cta')}>
                    <Box
                        className="all-found-trigger all-found-trigger-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={handleBreakdownClick}
                        onKeyDown={handleBreakdownKeyDown}
                        aria-label={t('scoring_rules.open_button_aria')}
                    >
                        <Typography
                            variant="h6"
                            className="all-found-text"
                            color="success.main"
                        >
                            <CelebrationIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                            {t('all_phrases_found')}
                            <CelebrationIcon sx={{ verticalAlign: 'middle', ml: 0.5 }} />
                        </Typography>
                    </Box>
                </Tooltip>
            ) : (
                <Typography
                    variant="h6"
                    className="all-found-text"
                    color="success.main"
                >
                    <CelebrationIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    {t('all_phrases_found')}
                    <CelebrationIcon sx={{ verticalAlign: 'middle', ml: 0.5 }} />
                </Typography>
            )}
            <Button
                onClick={() => refreshPuzzle(selectedCategory, difficulty)}
                className="new-game-button"
            >
                <Box component="span" className="new-game-text-desktop">
                    {t('new_game')}
                </Box>
                <Box component="span" className="new-game-text-mobile" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    <AutorenewIcon fontSize="small" />
                </Box>
            </Button>
        </Box>
    );
};

export default AllFoundMessage;
