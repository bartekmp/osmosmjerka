import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    TextField,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    IconButton,
    Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Dialog for sharing a private list with other users
 */
export default function ShareListDialog({
    open,
    onClose,
    onShare,
    onUnshare,
    loading,
    listShares,
}) {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [permission, setPermission] = useState('read');

    const handleShare = () => {
        onShare(username, permission);
        setUsername(''); // Reset after sharing
    };

    const handleClose = () => {
        setUsername('');
        setPermission('read');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('privateListManager.phrases.shareList', 'Share List')}</DialogTitle>
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        fullWidth
                        label={t('privateListManager.phrases.shareUsername', 'Username')}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        margin="dense"
                        disabled={loading}
                    />
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        <Chip
                            label={t('privateListManager.phrases.shareReadOnly', 'Read Only')}
                            color={permission === 'read' ? 'primary' : 'default'}
                            onClick={() => setPermission('read')}
                            clickable
                        />
                        <Chip
                            label={t('privateListManager.phrases.shareReadWrite', 'Read & Write')}
                            color={permission === 'write' ? 'primary' : 'default'}
                            onClick={() => setPermission('write')}
                            clickable
                        />
                    </Box>
                    <Button
                        variant="contained"
                        onClick={handleShare}
                        disabled={loading || !username.trim()}
                        sx={{ mt: 2 }}
                        fullWidth
                    >
                        {t('privateListManager.buttons.share', 'Share')}
                    </Button>
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                    {t('privateListManager.phrases.currentlyShared', 'Currently shared with:')}
                </Typography>
                {listShares.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        {t('privateListManager.phrases.notShared', 'Not shared with anyone')}
                    </Typography>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('privateListManager.phrases.user', 'User')}</TableCell>
                                <TableCell>{t('privateListManager.phrases.permission', 'Permission')}</TableCell>
                                <TableCell align="right">{t('privateListManager.phrases.actions', 'Actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {listShares.map((share) => (
                                <TableRow key={share.id}>
                                    <TableCell>{share.username}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={share.permission}
                                            size="small"
                                            color={share.permission === 'write' ? 'primary' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            size="small"
                                            onClick={() => onUnshare(share.shared_with_user_id)}
                                            disabled={loading}
                                            color="error"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t('privateListManager.buttons.close')}</Button>
            </DialogActions>
        </Dialog>
    );
}

ShareListDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onShare: PropTypes.func.isRequired,
    onUnshare: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    listShares: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            username: PropTypes.string.isRequired,
            permission: PropTypes.string.isRequired,
            shared_with_user_id: PropTypes.number.isRequired,
        })
    ),
};

ShareListDialog.defaultProps = {
    loading: false,
    listShares: [],
};
