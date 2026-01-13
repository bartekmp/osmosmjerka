import React from 'react';
import {
    Modal,
    Box,
    Typography,
    Button,
    Fade,
    Backdrop,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Chip
} from '@mui/material';
import {
    RocketLaunch as FeatureIcon,
    BugReport as BugIcon,
    AutoAwesome as ImprovementIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

/**
 * Modal component displaying changelog entries for recent versions
 */
export default function WhatsNewModal({ open, onClose, entries }) {
    const { t } = useTranslation();

    const modalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95%', sm: 500, md: 600 },
        bgcolor: 'background.paper',
        border: '2px solid #b89c4e',
        borderRadius: '7px',
        boxShadow: '2px 4px 12px rgba(0, 0, 0, 0.3)',
        p: { xs: 2, sm: 4 },
        maxWidth: '95vw',
        maxHeight: '85vh',
        overflow: 'auto'
    };

    const renderChangeList = (items, icon, color) => {
        if (!items || items.length === 0) return null;

        return (
            <List dense sx={{ py: 0 }}>
                {items.map((item, index) => (
                    <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32, color }}>
                            {icon}
                        </ListItemIcon>
                        <ListItemText
                            primary={item}
                            primaryTypographyProps={{
                                fontSize: '0.9rem',
                                lineHeight: 1.4
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        );
    };

    const renderVersionEntry = (entry, index) => {
        const hasFeatures = entry.features && entry.features.length > 0;
        const hasBugfixes = entry.bugfixes && entry.bugfixes.length > 0;
        const hasImprovements = entry.improvements && entry.improvements.length > 0;

        return (
            <Box key={entry.version} sx={{ mb: index < entries.length - 1 ? 3 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                        label={`v${entry.version}`}
                        size="small"
                        sx={{
                            bgcolor: '#b89c4e',
                            color: 'white',
                            fontWeight: 'bold'
                        }}
                    />
                    {entry.date && (
                        <Typography variant="caption" color="text.secondary">
                            {entry.date}
                        </Typography>
                    )}
                </Box>

                {hasFeatures && (
                    <Box sx={{ mb: 1 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 'bold', color: '#4caf50', mb: 0.5 }}
                        >
                            🚀 {t('whatsNew.features')}
                        </Typography>
                        {renderChangeList(entry.features, <FeatureIcon fontSize="small" />, '#4caf50')}
                    </Box>
                )}

                {hasBugfixes && (
                    <Box sx={{ mb: 1 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 'bold', color: '#f44336', mb: 0.5 }}
                        >
                            🐛 {t('whatsNew.bugfixes')}
                        </Typography>
                        {renderChangeList(entry.bugfixes, <BugIcon fontSize="small" />, '#f44336')}
                    </Box>
                )}

                {hasImprovements && (
                    <Box sx={{ mb: 1 }}>
                        <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 'bold', color: '#ff9800', mb: 0.5 }}
                        >
                            ✨ {t('whatsNew.improvements')}
                        </Typography>
                        {renderChangeList(entry.improvements, <ImprovementIcon fontSize="small" />, '#ff9800')}
                    </Box>
                )}

                {index < entries.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
        );
    };

    const hasEntries = entries && entries.length > 0;

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            slots={{ backdrop: Backdrop }}
            slotProps={{
                backdrop: {
                    timeout: 300,
                    sx: { backgroundColor: 'rgba(0, 0, 0, 0.6)' }
                }
            }}
        >
            <Fade in={open} timeout={300}>
                <Box sx={modalStyle}>
                    <Typography
                        variant="h5"
                        component="h2"
                        gutterBottom
                        align="center"
                        sx={{
                            fontFamily: '"Arial Black", Arial, sans-serif',
                            fontWeight: 'bold',
                            mb: 3
                        }}
                    >
                        🎉 {t('whatsNew.title')}
                    </Typography>

                    {hasEntries ? (
                        <Box sx={{ mb: 3 }}>
                            {entries.map((entry, index) => renderVersionEntry(entry, index))}
                        </Box>
                    ) : (
                        <Typography
                            align="center"
                            color="text.secondary"
                            sx={{ mb: 3, py: 2 }}
                        >
                            {t('whatsNew.empty')}
                        </Typography>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button
                            onClick={onClose}
                            className="scrabble-btn"
                            sx={{
                                px: 4,
                                py: 1.5,
                                fontSize: '1rem',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                }
                            }}
                        >
                            ✓ {t('whatsNew.dismiss')}
                        </Button>
                    </Box>
                </Box>
            </Fade>
        </Modal>
    );
}

WhatsNewModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    entries: PropTypes.arrayOf(PropTypes.shape({
        version: PropTypes.string.isRequired,
        date: PropTypes.string,
        features: PropTypes.arrayOf(PropTypes.string),
        bugfixes: PropTypes.arrayOf(PropTypes.string),
        improvements: PropTypes.arrayOf(PropTypes.string)
    }))
};

WhatsNewModal.defaultProps = {
    entries: []
};
