import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { LanguageSetSelector, PrivateListSelector } from '../../../../shared';
import ExportButton from '../../../export/components/ExportButton';
import CategorySelector from './CategorySelector';

const GameControls = ({
    panelOpen,
    setPanelOpen,
    visibleCategories,
    selectedCategory,
    setSelectedCategory,
    difficulty,
    setDifficulty,
    availableDifficulties,
    refreshPuzzle,
    selectedCategoryState,
    difficultyState,
    grid,
    phrases,
    isLoading,
    notEnoughPhrases,
    selectedLanguageSetId,
    onLanguageSetChange,
    onLanguageSetStatusChange,
    currentUser,
    selectedPrivateListId,
    onPrivateListChange,
    gameType = 'word_search'
}) => {
    const { t } = useTranslation();

    const hasLanguageSet = Boolean(selectedLanguageSetId);
    const hasCategories = Array.isArray(visibleCategories) && visibleCategories.length > 0;
    const categoryDisabled = !hasLanguageSet || !hasCategories;
    const difficultyDisabled = categoryDisabled;
    const refreshDisabled = categoryDisabled || !selectedCategoryState;

    return (
        <>
            {/* Mobile menu toggle button (burger / close), always shown on mobile */}
            <Box sx={{
                display: { xs: 'flex', sm: 'none' },
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                justifyContent: 'center',
                mb: 1,
            }}>
                <Button
                    onClick={() => setPanelOpen(!panelOpen)}
                    sx={{
                        minWidth: 0,
                        width: 250,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 2,
                        fontSize: '1.5rem',
                        backgroundColor: panelOpen ? 'action.selected' : 'background.paper',
                        '&:hover': {
                            backgroundColor: panelOpen ? 'action.hover' : 'action.hover',
                        }
                    }}
                    aria-label={panelOpen ? t('hide_controls') : t('show_controls')}
                >
                    {panelOpen ? <CloseIcon /> : <MenuIcon />}
                </Button>
            </Box>

            {/* Control Panel: collapsible on mobile, always visible on desktop */}
            <Box className={`control-panel ${panelOpen ? '' : 'hidden'}`}>
                {/* Dropdowns container */}
                <Box className="dropdowns-container">
                    {/* Language set selector (optional) */}
                    {typeof onLanguageSetChange === 'function' && (
                        <LanguageSetSelector
                            selectedLanguageSetId={selectedLanguageSetId}
                            onLanguageSetChange={onLanguageSetChange}
                            size="small"
                            onStatusChange={onLanguageSetStatusChange}
                        />
                    )}
                    {/* Private list selector (only shown when user is logged in) */}
                    <PrivateListSelector
                        currentUser={currentUser}
                        languageSetId={selectedLanguageSetId}
                        selectedListId={selectedPrivateListId}
                        onListChange={onPrivateListChange}
                        size="small"
                    />
                    <CategorySelector
                        categories={visibleCategories}
                        selected={selectedCategory}
                        onSelect={cat => setSelectedCategory(cat)}
                        disabled={categoryDisabled}
                    />
                    <FormControl fullWidth size="small" disabled={difficultyDisabled}>
                        <InputLabel>{t('difficulty')}</InputLabel>
                        <Select
                            value={difficulty}
                            label={t('difficulty')}
                            onChange={e => setDifficulty(e.target.value)}
                        >
                            {availableDifficulties.map(diff => (
                                <MenuItem key={diff.value} value={diff.value}>
                                    {gameType === 'crossword'
                                        ? t(`difficultyLevel.${diff.value}`)
                                        : t(diff.value)
                                    }
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Buttons container */}
                <Box className="buttons-container">
                    {/* Refresh button */}
                    <Button
                        onClick={() => refreshPuzzle(selectedCategoryState, difficultyState)}
                        title={t('reload_puzzle')}
                        aria-label={t('refresh')}
                        className="control-action-button"
                        disabled={refreshDisabled}
                    >
                        <RefreshIcon fontSize="small" />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
                            {t('refresh')}
                        </Box>
                    </Button>

                    {/* Export button */}
                    <ExportButton
                        category={selectedCategoryState}
                        grid={grid}
                        phrases={phrases}
                        gameType={gameType}
                        disabled={isLoading || grid.length === 0 || notEnoughPhrases}
                        t={t}
                        className="control-action-button"
                    />
                </Box>
            </Box>
        </>
    );
};

export default GameControls;
