import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import './ScoreDisplay.css';

const DEFAULT_DIFFICULTIES = ['easy', 'medium', 'hard', 'very_hard'];

const formatDuration = (seconds = 0) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '–';
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatMultiplier = (value) => {
    if (value === undefined || value === null) {
        return '1';
    }
    const rounded = Math.round(value * 10) / 10;
    return rounded % 1 === 0 ? `${rounded.toFixed(0)}` : `${rounded.toFixed(1)}`;
};

const ScoreDisplay = ({
    currentScore = 0,
    scoreBreakdown = null,
    phrasesFound = 0,
    totalPhrases = 0,
    hintsUsed = 0,
    showScore = true,
    compact = false,
    scoringRules = null,
    scoringRulesStatus = 'idle',
    onReloadScoringRules,
    registerDialogOpener
}) => {
    const { t } = useTranslation();
    const [dialogOpen, setDialogOpen] = useState(false);

    const isLoadingRules = scoringRulesStatus === 'loading';
    const hasRulesError = scoringRulesStatus === 'error';
    const difficultyOrder = scoringRules?.difficulty_order ?? DEFAULT_DIFFICULTIES;
    const difficultyMultipliers = scoringRules?.difficulty_multipliers ?? {};
    const timeBonusConfig = scoringRules?.time_bonus ?? {};
    const targetTimes = timeBonusConfig.target_times_seconds ?? {};
    const maxBonusPercent = timeBonusConfig.max_ratio ? Math.round(timeBonusConfig.max_ratio * 100) : null;
    const perPhraseBreakdown = scoreBreakdown?.per_phrase ?? [];
    const hasPerPhraseBreakdown = perPhraseBreakdown.length > 0;

    const handleOpenDialog = useCallback(() => {
        if (!scoringRules && !isLoadingRules) {
            onReloadScoringRules?.();
        }
        setDialogOpen(true);
    }, [scoringRules, isLoadingRules, onReloadScoringRules]);

    const handleCloseDialog = () => setDialogOpen(false);

    useEffect(() => {
        if (!showScore || typeof registerDialogOpener !== 'function') {
            return undefined;
        }

        registerDialogOpener(handleOpenDialog);
        return () => registerDialogOpener(null);
    }, [registerDialogOpener, handleOpenDialog, showScore]);

    const finalScore = scoreBreakdown?.final_score ?? currentScore;
    const difficultyKey = scoreBreakdown?.difficulty;
    const difficultyLabel = difficultyKey ? t(difficultyKey) : null;
    const durationSeconds = scoreBreakdown?.duration_seconds;
    const formattedDuration = durationSeconds != null ? formatDuration(durationSeconds) : '–';
    const totalHintsUsed = scoreBreakdown?.hints_used ?? hintsUsed ?? 0;
    const hintsSummary = totalHintsUsed > 0
        ? t('score_details.hints_used', { count: totalHintsUsed })
        : t('score_details.no_hints_used');

    const breakdownItems = useMemo(() => {
        if (!scoreBreakdown) {
            return [];
        }

        const baseScore = scoreBreakdown.base_score ?? 0;
        const difficultyBonus = scoreBreakdown.difficulty_bonus ?? 0;
        const timeBonus = scoreBreakdown.time_bonus ?? 0;
        const completionBonus = scoreBreakdown.streak_bonus ?? scoreBreakdown.completion_bonus ?? 0;
        const hintPenalty = scoreBreakdown.hint_penalty ?? 0;

        const items = [
            {
                key: 'base',
                label: t('base_score'),
                value: baseScore,
                tone: baseScore >= 0 ? 'positive' : 'negative'
            }
        ];

        if (difficultyBonus !== 0) {
            items.push({
                key: 'difficulty',
                label: t('difficulty_bonus'),
                value: difficultyBonus,
                tone: difficultyBonus >= 0 ? 'positive' : 'negative'
            });
        }

        if (timeBonus !== 0) {
            items.push({
                key: 'time',
                label: t('time_bonus'),
                value: timeBonus,
                tone: timeBonus >= 0 ? 'positive' : 'negative'
            });
        }

        if (completionBonus !== 0) {
            items.push({
                key: 'completion',
                label: t('completion_bonus'),
                value: completionBonus,
                tone: completionBonus >= 0 ? 'positive' : 'negative'
            });
        }

        if (hintPenalty !== 0) {
            items.push({
                key: 'hints',
                label: t('hint_penalty'),
                value: -Math.abs(hintPenalty),
                tone: 'negative'
            });
        }

        return items;
    }, [scoreBreakdown, t]);

    const renderBreakdownValue = (value) => {
        if (value === 0) return '0';
        return value > 0 ? `+${value}` : `${value}`;
    };

    const hasScoreBreakdown = Boolean(scoreBreakdown);

    const renderScoringRulesContent = () => {
        if (!scoringRules) {
            if (isLoadingRules) {
                return (
                    <Box className="score-rules-loading">
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                            {t('scoring_rules.loading')}
                        </Typography>
                    </Box>
                );
            }

            return (
                <Alert severity="error">
                    {t('scoring_rules.error')}
                </Alert>
            );
        }

        return (
            <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                    {t('scoring_rules.intro')}
                </Typography>
                <Box component="ul" className="score-rules-list">
                    <Typography component="li" variant="body2">
                        {t('scoring_rules.base', { points: scoringRules.base_points_per_phrase })}
                    </Typography>
                    <Box component="li" className="score-rules-sublist">
                        <Typography variant="body2">
                            {t('scoring_rules.difficulty')}
                        </Typography>
                        <Box component="ul" className="score-rules-nested">
                            {difficultyOrder.map((key) => {
                                const multiplier = difficultyMultipliers[key];
                                if (!multiplier) {
                                    return null;
                                }
                                return (
                                    <Typography key={key} component="li" variant="body2">
                                        {t('scoring_rules.difficulty_item', {
                                            difficultyLabel: t(key),
                                            multiplier: formatMultiplier(multiplier),
                                        })}
                                    </Typography>
                                );
                            })}
                        </Box>
                    </Box>
                    <Typography component="li" variant="body2">
                        {t('scoring_rules.completion', { points: scoringRules.completion_bonus_points })}
                    </Typography>
                    <Typography component="li" variant="body2">
                        {t('scoring_rules.hint', { points: scoringRules.hint_penalty_per_hint })}
                    </Typography>
                    <Box component="li" className="score-rules-sublist">
                        <Typography variant="body2">
                            {t('scoring_rules.time_bonus', { percent: maxBonusPercent ?? 50 })}
                        </Typography>
                        <Box component="ul" className="score-rules-nested">
                            {difficultyOrder.map((key) => {
                                const target = targetTimes[key];
                                if (!target) {
                                    return null;
                                }
                                return (
                                    <Typography key={key} component="li" variant="body2">
                                        {t('scoring_rules.time_bonus_item', {
                                            difficultyLabel: t(key),
                                            time: formatDuration(target),
                                        })}
                                    </Typography>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
                {hasRulesError && (
                    <Alert severity="warning">
                        {t('scoring_rules.error')}
                    </Alert>
                )}
            </Stack>
        );
    };

    const scoringAriaLabel = t('scoring_rules.open_button_aria');

    const handleScoreClick = () => {
        handleOpenDialog();
    };

    const handleScoreKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenDialog();
        }
    };

    const scoringDialog = (
        <Dialog
            open={dialogOpen}
            onClose={handleCloseDialog}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>{t('scoring_rules.title')}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3} className="score-dialog-section">
                    <Box>
                        <Typography variant="h6" className="score-dialog-heading">
                            {t('score_details.overview_title')}
                        </Typography>
                        {hasScoreBreakdown ? (
                            <Stack spacing={2} className="score-dialog-summary">
                                <Box className="score-dialog-total">
                                    <Typography variant="h4" component="p">
                                        🏆 {finalScore.toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('score_details.final_score_label')}
                                    </Typography>
                                </Box>
                                <Box className="score-dialog-meta">
                                    <Chip
                                        label={`${t('score_details.duration_label')}: ${formattedDuration}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={hintsSummary}
                                        size="small"
                                        variant="outlined"
                                        color={totalHintsUsed > 0 ? 'warning' : 'success'}
                                    />
                                    {difficultyLabel && (
                                        <Chip
                                            label={`${t('score_details.difficulty_label')}: ${difficultyLabel}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>
                                {breakdownItems.length > 0 && (
                                    <Box className="score-dialog-breakdown">
                                        <Typography variant="subtitle2" className="score-dialog-subheading">
                                            {t('score_details.bonuses_penalties_title')}
                                        </Typography>
                                        <Box className="score-dialog-breakdown-list">
                                            {breakdownItems.map((item) => (
                                                <Box
                                                    key={item.key}
                                                    className={`score-dialog-breakdown-row ${item.tone}`}
                                                >
                                                    <Typography variant="body2">
                                                        {item.label}
                                                    </Typography>
                                                    <Typography
                                                        variant="body2"
                                                        className="score-dialog-breakdown-value"
                                                    >
                                                        {renderBreakdownValue(item.value)}
                                                    </Typography>
                                                </Box>
                                            ))}
                                            <Box className="score-dialog-breakdown-row total">
                                                <Typography variant="body2">
                                                    {t('score_details.total_points')}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    className="score-dialog-breakdown-value"
                                                >
                                                    {renderBreakdownValue(finalScore)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                )}
                                {hasPerPhraseBreakdown && (
                                    <Box className="score-dialog-per-phrase">
                                        <Typography variant="subtitle2" className="score-dialog-subheading">
                                            {t('score_details.per_phrase_title')}
                                        </Typography>
                                        <Box component="ul" className="per-phrase-list">
                                            {perPhraseBreakdown.map((item) => (
                                                <Typography key={item.id} component="li" variant="body2">
                                                    {t('score_details.phrase_points', {
                                                        phrase: item.phrase,
                                                        points: item.points
                                                    })}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </Stack>
                        ) : (
                            <Alert severity="info">
                                {t('score_details.no_breakdown')}
                            </Alert>
                        )}
                    </Box>

                    <Divider />

                    <Box>
                        <Typography variant="h6" className="score-dialog-heading">
                            {t('score_details.rules_heading')}
                        </Typography>
                        {renderScoringRulesContent()}
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                {hasRulesError && (
                    <Button onClick={() => onReloadScoringRules?.()} color="primary">
                        {t('try_again')}
                    </Button>
                )}
                <Button onClick={handleCloseDialog} color="primary">
                    {t('close')}
                </Button>
            </DialogActions>
        </Dialog>
    );

    if (!showScore) {
        return null;
    }

    if (compact) {
        return (
            <>
                <Tooltip title={t('scoring_rules.cta')}>
                    <Box
                        className="score-display-compact score-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={handleScoreClick}
                        onKeyDown={handleScoreKeyDown}
                        aria-label={scoringAriaLabel}
                    >
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
                </Tooltip>
                {scoringDialog}
            </>
        );
    }

    return (
        <>
            <Card className="score-display-card" elevation={2}>
                <CardContent sx={{ padding: '12px !important' }}>
                    <Tooltip title={t('scoring_rules.cta')}>
                        <Box
                            className="score-header score-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={handleScoreClick}
                            onKeyDown={handleScoreKeyDown}
                            aria-label={scoringAriaLabel}
                        >
                            <Typography variant="h5" className="score-title">
                                🏆 {currentScore.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('current_score')}
                            </Typography>
                        </Box>
                    </Tooltip>

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
                            {hasPerPhraseBreakdown && (
                                <Box className="per-phrase-section">
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                        {t('score_details.per_phrase_title')}
                                    </Typography>
                                    <Box component="ul" className="per-phrase-list">
                                        {perPhraseBreakdown.map((item) => (
                                            <Typography key={item.id} component="li" variant="caption">
                                                {t('score_details.phrase_points', { phrase: item.phrase, points: item.points })}
                                            </Typography>
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>
            {scoringDialog}
        </>
    );
};

export default ScoreDisplay;
