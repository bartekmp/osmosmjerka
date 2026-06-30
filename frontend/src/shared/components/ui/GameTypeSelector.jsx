import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import SearchIcon from '@mui/icons-material/Search';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

/**
 * GameTypeSelector - Dropdown to select between game types
 * 
 * Displays current game type and allows switching between:
 * - Word Search (default)
 * - Crossword
 */
export default function GameTypeSelector({
    currentType = 'word_search',
    onChange,
    disabled = false,
    sx = {},
}) {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = useCallback((event) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleSelect = useCallback((type) => {
        handleClose();
        if (type !== currentType) {
            onChange?.(type);
        }
    }, [currentType, onChange, handleClose]);

    const gameTypes = [
        {
            id: 'word_search',
            label: t('gameType.word_search', 'Word Search'),
            icon: <SearchIcon />,
        },
        {
            id: 'crossword',
            label: t('gameType.crossword', 'Crossword'),
            icon: <GridViewIcon />,
        },
    ];

    const currentTypeData = gameTypes.find(g => g.id === currentType) || gameTypes[0];

    return (
        <Box>
            <Button
                id="game-type-button"
                aria-controls={open ? 'game-type-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                aria-label={t('gameType.select', 'Select game type')}
                title={`${t('gameType.label', 'Game mode')}: ${currentTypeData.label}`}
                onClick={handleClick}
                disabled={disabled}
                variant="outlined"
                sx={{
                    minWidth: 'auto',
                    px: { xs: 1, md: 1.5 },
                    borderRadius: 2,
                    textTransform: 'none',
                    gap: 0.5,
                    ...sx,
                }}
            >
                {currentTypeData.icon}
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' }, whiteSpace: 'nowrap' }}>
                    {currentTypeData.label}
                </Box>
                <ArrowDropDownIcon fontSize="small" />
            </Button>
            <Menu
                id="game-type-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                slotProps={{
                    list: {
                        'aria-labelledby': 'game-type-button',
                    },
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                {gameTypes.map((type) => (
                    <MenuItem
                        key={type.id}
                        onClick={() => handleSelect(type.id)}
                        selected={type.id === currentType}
                    >
                        <ListItemIcon>
                            {type.icon}
                        </ListItemIcon>
                        <ListItemText>{type.label}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
}
