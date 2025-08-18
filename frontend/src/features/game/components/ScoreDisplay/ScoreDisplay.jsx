import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Card, CardContent, Chip, Tooltip } from '@mui/material';
import './ScoreDisplay.css';

const ScoreDisplay = ({ 
    currentScore = 0,
    scoreBreakdown = null,
    phrasesFound = 0,
    totalPhrases = 0,
    hintsUsed = 0,
    showScore = true,
    compact = false
}) => {
    const { t } = useTranslation();

    if (!showScore) {
        return null;
    }

    if (compact) {
        return (
            <Box className="score-display-compact">
                <Typography
                    variant="h6"
                    className="score-value"
                    sx={{
                        fontWeight: 'bold',
                        color: 'primary.main'
                    }}
                >
                    🏆 {currentScore.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {phrasesFound}/{totalPhrases} {t('phrases')}
                </Typography>
            </Box>
        );
    }

    return (
        <Card className="score-display-card" elevation={2}>
            <CardContent sx={{ padding: '12px !important' }}>
                <Box className="score-header">
                    <Typography variant="h5" className="score-title">
                        🏆 {currentScore.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('current_score')}
                    </Typography>
                </Box>

                <Box className="score-stats">
                    <Chip 
                        label={`${phrasesFound}/${totalPhrases} ${t('phrases')}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                    {hintsUsed > 0 && (
                        <Tooltip title={t('hints_penalty', { count: hintsUsed })}>
                            <Chip 
                                label={`${hintsUsed} ${t('hints')}`}
                                color="warning"
                                variant="outlined"
                                size="small"
                            />
                        </Tooltip>
                    )}
                </Box>

                {scoreBreakdown && (
                    <Box className="score-breakdown">
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                            {t('score_breakdown')}:
                        </Typography>
                        <Box className="breakdown-items">
                            <Box className="breakdown-item">
                                <Typography variant="caption">{t('base_score')}:</Typography>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                    +{scoreBreakdown.base_score}
                                </Typography>
                            </Box>
                            {scoreBreakdown.difficulty_bonus > 0 && (
                                <Box className="breakdown-item">
                                    <Typography variant="caption">{t('difficulty_bonus')}:</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                        +{scoreBreakdown.difficulty_bonus}
                                    </Typography>
                                </Box>
                            )}
                            {scoreBreakdown.time_bonus > 0 && (
                                <Box className="breakdown-item">
                                    <Typography variant="caption">{t('time_bonus')}:</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                        +{scoreBreakdown.time_bonus}
                                    </Typography>
                                </Box>
                            )}
                            {scoreBreakdown.streak_bonus > 0 && (
                                <Box className="breakdown-item">
                                    <Typography variant="caption">{t('completion_bonus')}:</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                        +{scoreBreakdown.streak_bonus}
                                    </Typography>
                                </Box>
                            )}
                            {scoreBreakdown.hint_penalty > 0 && (
                                <Box className="breakdown-item">
                                    <Typography variant="caption">{t('hint_penalty')}:</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                        -{scoreBreakdown.hint_penalty}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default ScoreDisplay;
