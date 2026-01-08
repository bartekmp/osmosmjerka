import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardActions,
    Typography,
    Stack,
    Alert,
    CircularProgress,
    Chip,
    Divider,
    Tabs,
    Tab,
    Grid,
    Paper,
} from '@mui/material';
import {
    Group as GroupIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    ExitToApp as LeaveIcon,
    Extension as PuzzleIcon,
    PlayArrow as PlayIcon,
    School as SchoolIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStudentStudy } from './useStudentStudy';

/**
 * My Study - Student view of their assigned puzzles and study groups
 */
export default function MyStudy({ token }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tabValue, setTabValue] = useState(0);
    const [groups, setGroups] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [puzzles, setPuzzles] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const api = useStudentStudy({ token, setError });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [groupsData, invitesData, puzzlesData] = await Promise.all([
                api.fetchMyGroups(),
                api.fetchInvitations(),
                api.fetchAssignedPuzzles(),
            ]);
            setGroups(groupsData);
            setInvitations(invitesData);
            setPuzzles(puzzlesData.puzzles || []);
            setError('');
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const handleAccept = async (invitationId) => {
        try {
            await api.acceptInvitation(invitationId);
            loadData();
        } catch {
            // Error handled by hook
        }
    };

    const handleDecline = async (invitationId) => {
        try {
            await api.declineInvitation(invitationId);
            setInvitations(prev => prev.filter(i => i.id !== invitationId));
        } catch {
            // Error handled by hook
        }
    };

    const handleLeave = async (groupId) => {
        if (!window.confirm(t('student.study.confirm_leave', 'Are you sure you want to leave this group?'))) {
            return;
        }
        try {
            await api.leaveGroup(groupId);
            setGroups(prev => prev.filter(g => g.id !== groupId));
        } catch {
            // Error handled by hook
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handleStartPuzzle = (token) => {
        // Navigate to the puzzle hotlink page
        // Use window.open to open in new tab? Or navigate?
        // Usually better to keep in app.
        navigate(`/t/${token}`);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                {t('student.study.title', 'My Study')}
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="study tabs">
                    <Tab
                        icon={<PuzzleIcon />}
                        iconPosition="start"
                        label={t('student.study.puzzles_title', 'Assigned Puzzles')}
                    />
                    <Tab
                        icon={<SchoolIcon />}
                        iconPosition="start"
                        label={t('student.study.groups_title', 'My Study Groups')}
                    />
                </Tabs>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Tab Panel: Assigned Puzzles */}
            <div role="tabpanel" hidden={tabValue !== 0}>
                {tabValue === 0 && (
                    <Box>
                        {puzzles.length === 0 ? (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                {t('student.study.no_puzzles', 'No puzzles assigned yet.')}
                            </Typography>
                        ) : (
                            <>
                                {(() => {
                                    const solvedPuzzles = puzzles.filter(p => p.is_completed);
                                    const newPuzzles = puzzles.filter(p => !p.is_completed);

                                    const renderPuzzleCard = (puzzle) => (
                                        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <CardContent sx={{ flex: 1 }}>
                                                <Typography variant="h6" gutterBottom component="div">
                                                    {puzzle.name}
                                                </Typography>
                                                {puzzle.description && (
                                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {puzzle.description}
                                                    </Typography>
                                                )}
                                                <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                                                    {t('student.study.created_by_date', {
                                                        name: puzzle.creator_username || t('unknown'),
                                                        date: formatDate(puzzle.created_at)
                                                    })}
                                                </Typography>
                                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                                                    <Chip
                                                        size="small"
                                                        label={t('student.study.phrase_count', { count: puzzle.phrase_count, defaultValue: '{{count}} phrases' })}
                                                        variant="outlined"
                                                    />
                                                    {puzzle.expires_at && (
                                                        <Chip
                                                            size="small"
                                                            label={t('student.study.expires', { date: formatDate(puzzle.expires_at) })}
                                                            color="warning"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {puzzle.is_completed ? (
                                                        <Chip
                                                            size="small"
                                                            label={t('student.study.solved', 'Solved')}
                                                            color="success"
                                                        />
                                                    ) : (
                                                        <Chip
                                                            size="small"
                                                            label={t('student.study.new', 'New')}
                                                            color="info"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Stack>
                                            </CardContent>
                                            <CardActions>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    color="primary"
                                                    startIcon={<PlayIcon />}
                                                    onClick={() => handleStartPuzzle(puzzle.token)}
                                                >
                                                    {t('student.study.start_puzzle', 'Start')}
                                                </Button>
                                            </CardActions>
                                        </Card>
                                    );

                                    return (
                                        <Stack spacing={4}>
                                            {/* New Puzzles Section */}
                                            <Box>
                                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {t('student.study.new_puzzles', 'New Puzzles')}
                                                    <Chip label={newPuzzles.length} size="small" color="default" />
                                                </Typography>
                                                {newPuzzles.length > 0 ? (
                                                    <Grid container spacing={3}>
                                                        {newPuzzles.map(puzzle => (
                                                            <Grid item xs={12} sm={6} md={4} key={puzzle.id}>
                                                                {renderPuzzleCard(puzzle)}
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                ) : (
                                                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        {t('student.study.no_new_puzzles', 'No new puzzles.')}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Divider />

                                            {/* Solved Puzzles Section */}
                                            <Box>
                                                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {t('student.study.solved_puzzles', 'Solved Puzzles')}
                                                    <Chip label={solvedPuzzles.length} size="small" color="success" variant="outlined" />
                                                </Typography>
                                                {solvedPuzzles.length > 0 ? (
                                                    <Grid container spacing={3}>
                                                        {solvedPuzzles.map(puzzle => (
                                                            <Grid item xs={12} sm={6} md={4} key={puzzle.id}>
                                                                {renderPuzzleCard(puzzle)}
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                ) : (
                                                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                                        {t('student.study.no_solved_puzzles', 'No solved puzzles yet.')}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Stack>
                                    );
                                })()}
                            </>
                        )}
                    </Box>
                )}
            </div>

            {/* Tab Panel: My Study Groups */}
            <div role="tabpanel" hidden={tabValue !== 1}>
                {tabValue === 1 && (
                    <Box>
                        {/* Pending Invitations */}
                        {invitations.length > 0 && (
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    {t('student.study.pending_invitations', 'Pending Invitations')}
                                </Typography>
                                <Stack spacing={2}>
                                    {invitations.map(invite => (
                                        <Card key={invite.id} variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                                            <CardContent>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <GroupIcon color="primary" />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {invite.group_name}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {t('student.study.invited_by', { teacher: invite.teacher_username })}
                                                        </Typography>
                                                        {invite.expires_at && (
                                                            <Chip
                                                                size="small"
                                                                label={t('student.study.expires', { date: formatDate(invite.expires_at) })}
                                                                color="warning"
                                                                sx={{ mt: 0.5 }}
                                                            />
                                                        )}
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                            <CardActions>
                                                <Button
                                                    startIcon={<CheckIcon />}
                                                    color="success"
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => handleAccept(invite.id)}
                                                >
                                                    {t('student.study.accept', 'Accept')}
                                                </Button>
                                                <Button
                                                    startIcon={<CloseIcon />}
                                                    color="error"
                                                    size="small"
                                                    onClick={() => handleDecline(invite.id)}
                                                >
                                                    {t('student.study.decline', 'Decline')}
                                                </Button>
                                            </CardActions>
                                        </Card>
                                    ))}
                                </Stack>
                                <Divider sx={{ my: 3 }} />
                            </Box>
                        )}

                        {/* My Groups */}
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            {t('student.study.my_groups', 'My Groups')}
                        </Typography>

                        {groups.length === 0 ? (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                {t('student.study.no_groups', 'You are not a member of any study groups yet.')}
                            </Typography>
                        ) : (
                            <Grid container spacing={2}>
                                {groups.map(group => (
                                    <Grid item xs={12} md={6} key={group.id}>
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <GroupIcon color="primary" />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {group.name}
                                                        </Typography>
                                                        {group.teacher_username && (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {t('student.study.teacher', { name: group.teacher_username })}
                                                            </Typography>
                                                        )}
                                                        {group.joined_at && (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {t('student.study.joined_on', { date: formatDate(group.joined_at) })}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                            <CardActions>
                                                <Button
                                                    startIcon={<LeaveIcon />}
                                                    color="error"
                                                    size="small"
                                                    onClick={() => handleLeave(group.id)}
                                                >
                                                    {t('student.study.leave', 'Leave Group')}
                                                </Button>
                                            </CardActions>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Box>
                )
                }
            </div>
        </Paper>
    );
}
