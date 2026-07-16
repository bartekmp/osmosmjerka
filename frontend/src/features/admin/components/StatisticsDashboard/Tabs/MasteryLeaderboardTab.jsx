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
import { Star as StarIcon, LocalFireDepartment as StreakIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const MasteryLeaderboardTab = ({
    leaderboard,
    languageSets,
    filters,
    onFilterChange,
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

            {/* Leaderboard Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('rank')}</TableCell>
                            <TableCell>{t('player')}</TableCell>
                            <TableCell>{t('review.mastered', 'Mastered')}</TableCell>
                            <TableCell>{t('streak', 'Streak')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {leaderboard.map((row, index) => (
                            <TableRow key={`${row.user_id}-${index}`}>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {row.username}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="primary">
                                        {row.mastered?.toLocaleString() || 0}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {row.current_streak > 0 ? (
                                        <Chip
                                            icon={<StreakIcon fontSize="small" />}
                                            label={row.current_streak}
                                            size="small"
                                            color="warning"
                                        />
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">0</Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {leaderboard.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    <Typography variant="body2" color="text.secondary">
                                        {t('no_leaderboard_entries', 'No mastered words yet')}
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

MasteryLeaderboardTab.propTypes = {
    leaderboard: PropTypes.array.isRequired,
    languageSets: PropTypes.array.isRequired,
    filters: PropTypes.object.isRequired,
    onFilterChange: PropTypes.func.isRequired,
};

export default MasteryLeaderboardTab;
