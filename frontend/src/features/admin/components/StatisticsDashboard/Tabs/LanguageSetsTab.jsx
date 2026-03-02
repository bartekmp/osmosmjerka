import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Grid,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const LanguageSetsTab = ({ languageSetStats }) => {
    const { t } = useTranslation();

    if (!languageSetStats) return null;

    return (
        <Grid container spacing={3}>
            {languageSetStats.map((stat) => (
                <Grid size={{ xs: 12, md: 6 }} key={stat.language_set_id}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {stat.language_set_display_name}
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid size={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('games_completed')}
                                    </Typography>
                                    <Typography variant="h6">
                                        {stat.games_completed}/{stat.games_started}
                                    </Typography>
                                </Grid>

                                <Grid size={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('unique_players')}
                                    </Typography>
                                    <Typography variant="h6">
                                        {stat.unique_players}
                                    </Typography>
                                </Grid>

                                <Grid size={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('phrases_found')}
                                    </Typography>
                                    <Typography variant="h6">
                                        {stat.phrases_found}
                                    </Typography>
                                </Grid>

                                <Grid size={6}>
                                    <Typography variant="body2" color="textSecondary">
                                        {t('time_played')}
                                    </Typography>
                                    <Typography variant="h6">
                                        {stat.time_played_hours}h
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );
};

LanguageSetsTab.propTypes = {
    languageSetStats: PropTypes.arrayOf(PropTypes.shape({
        language_set_id: PropTypes.number.isRequired,
        language_set_display_name: PropTypes.string.isRequired,
        games_completed: PropTypes.number,
        games_started: PropTypes.number,
        unique_players: PropTypes.number,
        phrases_found: PropTypes.number,
        time_played_hours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })),
};

export default LanguageSetsTab;
