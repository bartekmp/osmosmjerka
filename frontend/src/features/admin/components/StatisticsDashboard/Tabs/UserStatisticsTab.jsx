import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    useTheme,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Star as StarIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const UserStatisticsTab = ({
    userStatistics,
    languageSets,
    selectedLanguageSet,
    onLanguageSetChange,
    onUserSelect,
    selectedUserDetail,
    formatTime,
    formatDate
}) => {
    const { t } = useTranslation();
    const theme = useTheme();

    return (
        <Box>
            <FormControl sx={{ mb: 3, minWidth: 200 }}>
                <InputLabel>{t('filter_by_language_set')}</InputLabel>
                <Select
                    value={selectedLanguageSet}
                    onChange={onLanguageSetChange}
                    label={t('filter_by_language_set')}
                >
                    <MenuItem value="">{t('all_language_sets')}</MenuItem>
                    {languageSets.map((langSet) => (
                        <MenuItem key={langSet.id} value={langSet.id}>
                            {langSet.display_name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('username')}</TableCell>
                            <TableCell align="right">{t('games_completed')}</TableCell>
                            <TableCell align="right">{t('phrases_found')}</TableCell>
                            <TableCell align="right">{t('time_played')}</TableCell>
                            <TableCell align="right">{t('phrases_added')}</TableCell>
                            <TableCell align="right">{t('last_activity')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {userStatistics.map((user) => (
                            <TableRow
                                key={user.id}
                                sx={{
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: theme.palette.action.hover }
                                }}
                                onClick={() => onUserSelect(user.id)}
                            >
                                <TableCell component="th" scope="row">
                                    {user.username}
                                </TableCell>
                                <TableCell align="right">
                                    {user.games_completed}/{user.games_started}
                                </TableCell>
                                <TableCell align="right">
                                    {user.total_phrases_found || 0}
                                </TableCell>
                                <TableCell align="right">
                                    {formatTime(user.total_time_played_seconds)}
                                </TableCell>
                                <TableCell align="right">
                                    {(user.phrases_added || 0) + (user.phrases_edited || 0)}
                                </TableCell>
                                <TableCell align="right">
                                    {formatDate(user.last_played)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* User Detail Modal/Expansion */}
            {selectedUserDetail && (
                <Card sx={{ mt: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            {t('detailed_statistics')} - {selectedUserDetail.user?.username || `User ${selectedUserDetail.statistics.user_id}`}
                        </Typography>

                        {(selectedUserDetail.favorite_categories || []).map((langSetData, index) => (
                            <Accordion key={index}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>
                                        {langSetData.language_set_name} - {t('favorite_categories')}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box display="flex" flexWrap="wrap" gap={1}>
                                        {(langSetData.categories || []).map((cat, catIndex) => (
                                            <Chip
                                                key={catIndex}
                                                icon={<StarIcon />}
                                                label={`${cat.category} (${cat.plays_count} ${t('plays')})`}
                                                variant="outlined"
                                                color="primary"
                                            />
                                        ))}
                                        {(!langSetData.categories || langSetData.categories.length === 0) && (
                                            <Typography variant="body2" color="text.secondary">
                                                {t('no_favorite_categories', 'No favorite categories')}
                                            </Typography>
                                        )}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

UserStatisticsTab.propTypes = {
    userStatistics: PropTypes.array.isRequired,
    languageSets: PropTypes.array.isRequired,
    selectedLanguageSet: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onLanguageSetChange: PropTypes.func.isRequired,
    onUserSelect: PropTypes.func.isRequired,
    selectedUserDetail: PropTypes.object,
    formatTime: PropTypes.func.isRequired,
    formatDate: PropTypes.func.isRequired,
};

export default UserStatisticsTab;
