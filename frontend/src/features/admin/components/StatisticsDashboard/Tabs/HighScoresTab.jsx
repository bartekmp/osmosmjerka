import React from 'react';
import {
    Box,
    Typography,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
} from '@mui/material';
import { Star as StarIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const HighScoresTab = ({
    highScores,
    languageSets,
    filters,
    onFilterChange,
    formatTime
}) => {
    const { t } = useTranslation();

    return (
        <Box>
            {/* Filters */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('language_set')}</InputLabel>
                        <Select
                            value={filters.languageSet}
                            onChange={(e) => onFilterChange('languageSet', e.target.value)}
                            label={t('language_set')}
                        >
                            <MenuItem value="">{t('all_language_sets')}</MenuItem>
                            {languageSets.map((langSet) => (
                                <MenuItem key={langSet.id} value={langSet.id}>
                                    {langSet.display_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('category')}</InputLabel>
                        <Select
                            value={filters.category}
                            onChange={(e) => onFilterChange('category', e.target.value)}
                            label={t('category')}
                        >
                            <MenuItem value="">{t('all_categories')}</MenuItem>
                            {/* Categories would need to be loaded separately or extracted from existing data */}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('difficulty')}</InputLabel>
                        <Select
                            value={filters.difficulty}
                            onChange={(e) => onFilterChange('difficulty', e.target.value)}
                            label={t('difficulty')}
                        >
                            <MenuItem value="">{t('all_difficulties')}</MenuItem>
                            <MenuItem value="very_easy">{t('very_easy')}</MenuItem>
                            <MenuItem value="easy">{t('easy')}</MenuItem>
                            <MenuItem value="medium">{t('medium')}</MenuItem>
                            <MenuItem value="hard">{t('hard')}</MenuItem>
                            <MenuItem value="very_hard">{t('very_hard')}</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('game_type')}</InputLabel>
                        <Select
                            value={filters.gameType}
                            onChange={(e) => onFilterChange('gameType', e.target.value)}
                            label={t('game_type')}
                        >
                            <MenuItem value="">{t('all_game_types')}</MenuItem>
                            <MenuItem value="word_search">{t('gameType.word_search')}</MenuItem>
                            <MenuItem value="crossword">{t('gameType.crossword')}</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('limit')}</InputLabel>
                        <Select
                            value={filters.limit}
                            onChange={(e) => onFilterChange('limit', e.target.value)}
                            label={t('limit')}
                        >
                            <MenuItem value={25}>25</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                            <MenuItem value={200}>200</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {/* High Scores Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('rank')}</TableCell>
                            <TableCell>{t('player')}</TableCell>
                            <TableCell>{t('score')}</TableCell>
                            <TableCell>{t('category')}</TableCell>
                            <TableCell>{t('difficulty')}</TableCell>
                            <TableCell>{t('completion')}</TableCell>
                            <TableCell>{t('time')}</TableCell>
                            <TableCell>{t('hints_used')}</TableCell>
                            <TableCell>{t('date')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {highScores.map((score, index) => (
                            <TableRow key={`${score.user_id}-${score.created_at}-${index}`}>
                                <TableCell>
                                    <Box display="flex" alignItems="center">
                                        {index < 3 && (
                                            <StarIcon
                                                sx={{
                                                    mr: 1,
                                                    color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'
                                                }}
                                            />
                                        )}
                                        #{index + 1}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="medium">
                                        {score.username}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="bold" color="primary">
                                        {score.final_score?.toLocaleString() || 0}
                                    </Typography>
                                </TableCell>
                                <TableCell>{score.category}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={t(score.difficulty)}
                                        size="small"
                                        color={
                                            score.difficulty === 'very_easy' ? 'info' :
                                                score.difficulty === 'easy' ? 'success' :
                                                    score.difficulty === 'medium' ? 'warning' :
                                                        score.difficulty === 'hard' ? 'error' :
                                                            'secondary'
                                        }
                                    />
                                </TableCell>
                                <TableCell>
                                    {score.phrases_found}/{score.total_phrases}
                                    {score.phrases_found === score.total_phrases && (
                                        <Chip label={t('perfect')} size="small" color="success" sx={{ ml: 1 }} />
                                    )}
                                </TableCell>
                                <TableCell>{formatTime(score.duration_seconds)}</TableCell>
                                <TableCell>
                                    {score.hints_used > 0 ? (
                                        <Chip label={score.hints_used} size="small" color="warning" />
                                    ) : (
                                        <Chip label="0" size="small" color="success" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        {score.created_at ? new Date(score.created_at).toLocaleDateString() : '-'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                        {highScores.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} align="center">
                                    <Typography variant="body2" color="text.secondary">
                                        {t('no_high_scores')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

HighScoresTab.propTypes = {
    highScores: PropTypes.array.isRequired,
    languageSets: PropTypes.array.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired,
    formatTime: PropTypes.func.isRequired,
};

export default HighScoresTab;
