import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Badge, Box, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import './HintButton.css';

const HintButton = ({ 
    onHintRequest,
    remainingHints = 3,
    isProgressiveMode = false,
    disabled = false,
    currentHintLevel = 0,
    showHintButton = true
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);

    if (!showHintButton) {
        return null;
    }

    const handleHintClick = async () => {
        if (disabled || remainingHints <= 0) return;
        
        setIsLoading(true);
        try {
            await onHintRequest();
        } finally {
            setIsLoading(false);
        }
    };

    const getHintButtonText = () => {
        if (isProgressiveMode) {
            if (currentHintLevel === 0) return t('first_letter');
            if (currentHintLevel === 1) return t('direction_hint');
            if (currentHintLevel === 2) return t('full_outline');
            return t('hint');
        }
        return t('show_hint');
    };

    const getTooltipText = () => {
        if (disabled) return t('no_phrases_available');
        if (remainingHints <= 0) return t('no_hints_remaining');
        
        if (isProgressiveMode) {
            return t('progressive_hint_tooltip', { 
                remaining: remainingHints,
                level: currentHintLevel + 1 
            });
        }
        
        return t('hint_tooltip');
    };

    const buttonColor = isProgressiveMode ? 'secondary' : 'primary';
    const icon = isProgressiveMode ? <FlashOnIcon /> : <HelpOutlineIcon />;

    return (
        <Box className="hint-button-container">
            <Tooltip title={getTooltipText()}>
                <span>
                    <Badge 
                        badgeContent={isProgressiveMode ? remainingHints : null}
                        color="error"
                        sx={{ 
                            '& .MuiBadge-badge': { 
                                display: isProgressiveMode && remainingHints > 0 ? 'flex' : 'none' 
                            } 
                        }}
                    >
                        <Button
                            variant="contained"
                            color={buttonColor}
                            onClick={handleHintClick}
                            disabled={disabled || remainingHints <= 0 || isLoading}
                            startIcon={icon}
                            className={`hint-button ${isProgressiveMode ? 'progressive' : 'classic'}`}
                            sx={{
                                minWidth: '120px',
                                fontSize: '0.9rem',
                                textTransform: 'none',
                                color: 'common.white',
                                '& .MuiButton-startIcon': {
                                    color: 'inherit'
                                },
                                '& .MuiButton-startIcon svg': {
                                    color: 'inherit'
                                },
                                '&.Mui-disabled': {
                                    color: 'rgba(255,255,255,0.7)',
                                    '& .MuiButton-startIcon': {
                                        color: 'rgba(255,255,255,0.7)'
                                    },
                                    '& .MuiButton-startIcon svg': {
                                        color: 'rgba(255,255,255,0.7)'
                                    }
                                }
                            }}
                        >
                            {isLoading ? t('loading') : getHintButtonText()}
                        </Button>
                    </Badge>
                </span>
            </Tooltip>
            
            {isProgressiveMode && (
                <Typography 
                    variant="caption" 
                    color="text.secondary"
                    className="hint-counter"
                >
                    {t('hints_remaining', { count: remainingHints })}
                </Typography>
            )}
        </Box>
    );
};

export default HintButton;
