import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    People as PeopleIcon,
    Games as GamesIcon,
    Timer as TimerIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const OverviewTab = ({ overview }) => {
    const { t } = useTranslation();

    if (!overview) return null;

    return (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                    <CardContent>
                        <Box display="flex" alignItems="center">
                            <PeopleIcon color="primary" sx={{ mr: 2 }} />
                            <Box>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('total_users')}
                                </Typography>
                                <Typography variant="h4">
                                    {overview.total_users}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                    <CardContent>
                        <Box display="flex" alignItems="center">
                            <TrendingUpIcon color="success" sx={{ mr: 2 }} />
                            <Box>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('active_users_30d')}
                                </Typography>
                                <Typography variant="h4">
                                    {overview.active_users_30d}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                    <CardContent>
                        <Box display="flex" alignItems="center">
                            <GamesIcon color="info" sx={{ mr: 2 }} />
                            <Box>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('total_games')}
                                </Typography>
                                <Typography variant="h4">
                                    {overview.total_games_completed}/{overview.total_games_started}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                    <CardContent>
                        <Box display="flex" alignItems="center">
                            <TimerIcon color="warning" sx={{ mr: 2 }} />
                            <Box>
                                <Typography color="textSecondary" gutterBottom>
                                    {t('total_time_played')}
                                </Typography>
                                <Typography variant="h4">
                                    {overview.total_time_played_hours}h
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );
};

OverviewTab.propTypes = {
    overview: PropTypes.shape({
        total_users: PropTypes.number,
        active_users_30d: PropTypes.number,
        total_games_completed: PropTypes.number,
        total_games_started: PropTypes.number,
        total_time_played_hours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
};

export default OverviewTab;
