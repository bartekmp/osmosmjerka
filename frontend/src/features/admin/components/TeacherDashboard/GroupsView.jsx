import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardActions,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Typography,
    Stack,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Alert,
    CircularProgress,
    Grid
} from '@mui/material';
import {
    Add as AddIcon,
    PersonAdd as PersonAddIcon,
    Group as GroupIcon,
    PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGroups } from './useGroups';

/**
 * Groups Management View
 */
export default function GroupsView({ token }) {
    const { t } = useTranslation();
    const [groups, setGroups] = useState([]);
    const [error, setError] = useState('');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null); // For detail view/dialog
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    // Group creation state
    const [newGroupName, setNewGroupName] = useState('');

    // Member management state
    const [members, setMembers] = useState([]);
    const [newMemberUsername, setNewMemberUsername] = useState('');
    const [loadingMembers, setLoadingMembers] = useState(false);

    const api = useGroups({ token, setError });

    const loadGroups = useCallback(async () => {
        try {
            const data = await api.fetchGroups();
            setGroups(data);
        } catch {
            // Error handled by hook
        }
    }, [api]);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await api.createGroup(newGroupName);
            setNewGroupName('');
            setCreateDialogOpen(false);
            loadGroups();
        } catch {
            // Error handled by hook
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm(t('teacher.groups.confirm_delete', 'Are you sure you want to delete this group?'))) return;
        try {
            await api.deleteGroup(groupId);
            loadGroups();
            if (selectedGroup?.id === groupId) {
                setDetailDialogOpen(false);
                setSelectedGroup(null);
            }
        } catch {
            // Error handled by hook
        }
    };

    const openGroupDetails = async (group) => {
        setSelectedGroup(group);
        setDetailDialogOpen(true);
        setLoadingMembers(true);
        setMembers([]);
        try {
            const data = await api.fetchGroupMembers(group.id);
            setMembers(data);
        } catch {
            // Error handled by hook
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberUsername.trim() || !selectedGroup) return;
        try {
            await api.addMember(selectedGroup.id, newMemberUsername);
            setNewMemberUsername('');
            // Refresh members
            const data = await api.fetchGroupMembers(selectedGroup.id);
            setMembers(data);
            // Refresh groups to update count
            loadGroups();
        } catch {
            // Error handled by hook
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!selectedGroup) return;
        try {
            await api.removeMember(selectedGroup.id, userId);
            setMembers(prev => prev.filter(m => m.id !== userId));
            loadGroups();
        } catch {
            // Error handled by hook
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6">
                    {t('teacher.groups.title', 'My Groups')}
                </Typography>
                <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    onClick={() => setCreateDialogOpen(true)}
                >
                    {t('teacher.groups.create', 'Create Group')}
                </Button>
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {api.isLoading && !detailDialogOpen && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            <Grid container spacing={2}>
                {groups.map(group => (
                    <Grid item xs={12} sm={6} md={4} key={group.id}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <GroupIcon color="primary" />
                                    <Typography variant="h6">{group.name}</Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                    {t('teacher.groups.member_count', { count: group.member_count, defaultValue: '{{count}} students' })}
                                </Typography>
                            </CardContent>
                            <CardActions>
                                <Button size="small" onClick={() => openGroupDetails(group)}>
                                    {t('teacher.groups.manage', 'Manage Members')}
                                </Button>
                                <Button size="small" color="error" onClick={() => handleDeleteGroup(group.id)}>
                                    {t('delete', 'Delete')}
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Create Group Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
                <DialogTitle>{t('teacher.groups.create_title', 'Create New Group')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('teacher.groups.name_label', 'Group Name')}
                        fullWidth
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>{t('cancel', 'Cancel')}</Button>
                    <Button onClick={handleCreateGroup} variant="contained">{t('create', 'Create')}</Button>
                </DialogActions>
            </Dialog>

            {/* Group Details Dialog */}
            <Dialog
                open={detailDialogOpen}
                onClose={() => setDetailDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {selectedGroup ? t('teacher.groups.manage_title', { name: selectedGroup.name, defaultValue: 'Manage {{name}}' }) : ''}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                label={t('teacher.groups.add_student_label', 'Student Username')}
                                fullWidth
                                size="small"
                                value={newMemberUsername}
                                onChange={(e) => setNewMemberUsername(e.target.value)}
                            />
                            <Button
                                variant="contained"
                                startIcon={<PersonAddIcon />}
                                onClick={handleAddMember}
                                disabled={!newMemberUsername}
                            >
                                {t('add', 'Add')}
                            </Button>
                        </Stack>

                        <Typography variant="subtitle2" sx={{ mt: 2 }}>
                            {t('teacher.groups.members_list', 'Members')}
                        </Typography>

                        {loadingMembers ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : (
                            <List dense sx={{ bgcolor: 'background.paper', border: '1px solid #eee', borderRadius: 1, maxHeight: 300, overflow: 'auto' }}>
                                {members.length === 0 ? (
                                    <ListItem>
                                        <ListItemText secondary={t('teacher.groups.no_members', 'No students in this group yet')} />
                                    </ListItem>
                                ) : members.map(member => (
                                    <ListItem key={member.id}>
                                        <ListItemText primary={member.username} secondary={new Date(member.added_at).toLocaleDateString()} />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" size="small" onClick={() => handleRemoveMember(member.id)}>
                                                <PersonRemoveIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailDialogOpen(false)}>{t('close', 'Close')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
