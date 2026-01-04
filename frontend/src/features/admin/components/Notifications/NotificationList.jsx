import React from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemText,
    ListItemButton,
    Typography,
    IconButton,
    Paper,
    Divider,
    Button,
    Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleIcon from '@mui/icons-material/Circle';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const NotificationList = ({
    notifications,
    onRead,
    onDelete,
    onReadAll,
    onNavigate,
    loading
}) => {
    const { t } = useTranslation();

    if (loading) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('loading', 'Loading...')}</Typography>
            </Box>
        );
    }

    if (!notifications || notifications.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                    {t('admin.notifications.empty', 'No notifications')}
                </Typography>
            </Box>
        );
    }

    return (
        <Paper elevation={0} sx={{ maxHeight: 400, overflow: 'auto' }}>
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', borderBottom: 1, borderColor: 'divider' }}>
                <Button size="small" onClick={onReadAll}>
                    {t('admin.notifications.mark_all_read', 'Mark all as read')}
                </Button>
            </Box>
            <List disablePadding>
                {notifications.map((notification) => (
                    <React.Fragment key={notification.id}>
                        <ListItem
                            disablePadding
                            secondaryAction={
                                <IconButton
                                    edge="end"
                                    aria-label="delete"
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(notification.id);
                                    }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            }
                            sx={{
                                bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                                transition: 'background-color 0.2s',
                            }}
                        >
                            <ListItemButton
                                onClick={() => {
                                    if (!notification.is_read) onRead(notification.id);
                                    if (notification.link) onNavigate(notification.link);
                                }}
                                alignItems="flex-start"
                            >
                                <Box sx={{ mt: 1, mr: 2 }}>
                                    {!notification.is_read ? (
                                        <CircleIcon color="primary" sx={{ fontSize: 12 }} />
                                    ) : (
                                        <CheckCircleIcon color="disabled" sx={{ fontSize: 16 }} />
                                    )}
                                </Box>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle2" component="span">
                                                {notification.title}
                                            </Typography>
                                            {notification.type === 'translation_review' && (
                                                <Chip
                                                    label={t('admin.notifications.review', 'Review')}
                                                    size="small"
                                                    color="warning"
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.625rem' }}
                                                />
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <>
                                            <Typography
                                                component="span"
                                                variant="body2"
                                                color="text.primary"
                                                display="block"
                                                sx={{ my: 0.5 }}
                                            >
                                                {notification.message}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(notification.created_at).toLocaleString()}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                        <Divider component="li" />
                    </React.Fragment>
                ))}
            </List>
        </Paper>
    );
};

NotificationList.propTypes = {
    notifications: PropTypes.array.isRequired,
    onRead: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onReadAll: PropTypes.func.isRequired,
    onNavigate: PropTypes.func.isRequired,
    loading: PropTypes.bool
};

export default NotificationList;
