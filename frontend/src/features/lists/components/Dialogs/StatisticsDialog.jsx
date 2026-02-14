import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Table,
    TableBody,
    TableRow,
    TableCell,
    CircularProgress,
    Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for displaying list and user statistics
 */
export default function StatisticsDialog({
    open,
    onClose,
    onRefresh,
    loading,
    listStats,
    userStats,
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('privateListManager.phrases.statisticsTitle', 'List Statistics')}</DialogTitle>
            <DialogContent>
                {listStats ? (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            {listStats.list_name}
                        </Typography>
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <TableCell>Total Phrases</TableCell>
                                    <TableCell align="right"><strong>{listStats.total_phrases}</strong></TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Custom Phrases</TableCell>
                                    <TableCell align="right">{listStats.custom_phrases}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Public Phrases</TableCell>
                                    <TableCell align="right">{listStats.public_phrases}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Created</TableCell>
                                    <TableCell align="right">
                                        {listStats.created_at ? new Date(listStats.created_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Last Updated</TableCell>
                                    <TableCell align="right">
                                        {listStats.updated_at ? new Date(listStats.updated_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Box>
                ) : (
                    <CircularProgress />
                )}

                {userStats && (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            {t('privateListManager.phrases.overallStatistics', 'Your Overall Statistics')}
                        </Typography>
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <TableCell>Total Lists</TableCell>
                                    <TableCell align="right"><strong>{userStats.total_lists}</strong></TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Total Phrases</TableCell>
                                    <TableCell align="right"><strong>{userStats.total_phrases}</strong></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        {userStats.most_used_lists && userStats.most_used_lists.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Most Used Lists:
                                </Typography>
                                {userStats.most_used_lists.map((list) => (
                                    <Box key={list.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="body2">{list.list_name}</Typography>
                                        <Chip label={`${list.phrase_count} phrases`} size="small" />
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onRefresh} disabled={loading}>
                    Refresh Stats
                </Button>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

StatisticsDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    listStats: PropTypes.shape({
        list_name: PropTypes.string,
        total_phrases: PropTypes.number,
        custom_phrases: PropTypes.number,
        public_phrases: PropTypes.number,
        created_at: PropTypes.string,
        updated_at: PropTypes.string,
    }),
    userStats: PropTypes.shape({
        total_lists: PropTypes.number,
        total_phrases: PropTypes.number,
        most_used_lists: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.number,
                list_name: PropTypes.string,
                phrase_count: PropTypes.number,
            })
        ),
    }),
};

StatisticsDialog.defaultProps = {
    loading: false,
    listStats: null,
    userStats: null,
};
