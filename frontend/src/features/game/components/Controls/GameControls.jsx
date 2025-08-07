import React from 'react';
import { Box, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CategorySelector from './CategorySelector';
import ExportButton from '../../../export/components/ExportButton';

const GameControls = ({
    panelOpen,
    setPanelOpen,
    visibleCategories,
    selectedCategory,
    setSelectedCategory,
    difficulty,
    setDifficulty,
    availableDifficulties,
    loadPuzzle,
    selectedCategoryState,
    difficultyState,
    grid,
    phrases,
    isLoading,
    notEnoughPhrases
}) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Toggle button for mobile, only when menu is closed */}
            {!panelOpen && (
                <Box className="mobile-menu-toggle">
                    <Button
                        onClick={() => setPanelOpen(true)}
                        className="mobile-menu-button"
                        aria-label={t('show_controls')}
                    >
                        {t('menu')} ⬇️
                    </Button>
                </Box>
            )}

            {/* Control Panel: collapsible on mobile, always visible on desktop */}
            <Box className={`control-panel ${panelOpen ? '' : 'hidden'}`}>
                {/* Dropdowns container */}
                <Box className="dropdowns-container">
                    <CategorySelector
                        categories={visibleCategories}
                        selected={selectedCategory}
                        onSelect={cat => setSelectedCategory(cat)}
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel>{t('difficulty')}</InputLabel>
                        <Select
                            value={difficulty}
                            label={t('difficulty')}
                            onChange={e => setDifficulty(e.target.value)}
                        >
                            {availableDifficulties.map(diff => (
                                <MenuItem key={diff.value} value={diff.value}>
                                    {t(diff.value)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Buttons container */}
                <Box className="buttons-container">
                    {/* Refresh button */}
                    <Button
                        onClick={() => loadPuzzle(selectedCategoryState, difficultyState)}
                        title={t('reload_puzzle')}
                        className="refresh-button"
                    >
                        <span>🔄</span>
                        <Box component="span" className="refresh-button-text">
                            {t('refresh')}
                        </Box>
                    </Button>

                    {/* Export button */}
                    <ExportButton
                        category={selectedCategoryState}
                        grid={grid}
                        phrases={phrases}
                        disabled={isLoading || grid.length === 0 || notEnoughPhrases}
                        t={t}
                    />

                    {/* Hide menu button for mobile, only when menu is open */}
                    {panelOpen && (
                        <Button
                            onClick={() => setPanelOpen(false)}
                            className="hide-menu-button"
                            aria-label={t('hide_controls')}
                        >
                            ⬆️
                        </Button>
                    )}
                </Box>
            </Box>
        </>
    );
};

export default GameControls;
