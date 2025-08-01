import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

const AllFoundMessage = ({ allFound, loadPuzzle, selectedCategory, difficulty }) => {
    const { t } = useTranslation();

    if (!allFound) return null;

    return (
        <Box className="all-found-message">
            <Typography
                variant="h6"
                className="all-found-text"
                color="success.main"
            >
                🎉 {t('all_words_found')} 🎊
            </Typography>
            <Button
                onClick={() => loadPuzzle(selectedCategory, difficulty)}
                className="new-game-button"
            >
                <Box component="span" className="new-game-text-desktop">
                    {t('new_game')}
                </Box>
                <Box component="span" className="new-game-text-mobile">
                    🎮
                </Box>
            </Button>
        </Box>
    );
};

export default AllFoundMessage;
