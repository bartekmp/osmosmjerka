import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormGroup,
    InputLabel,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Select,
    Slider,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Switch,
    TextField,
    Typography,
    Alert,
    CircularProgress,
    Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTeacherApi } from './useTeacherApi';
import { usePhraseSetForm } from './usePhraseSetForm';

const STEP_KEYS = ['teacher.create.steps.basic', 'teacher.create.steps.select', 'teacher.create.steps.configure'];

/**
 * Dialog for creating a new phrase set
 */
function CreatePhraseSetDialog({ open, onClose, onCreated, languageSets, currentLanguageSetId }) {
    // Stepper state
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Create-only: the basic-info step lets the teacher pick a game type.
    const [gameType, setGameType] = useState('word_search');

    const { t } = useTranslation();
    const form = usePhraseSetForm({ setError });
    const {
        name, setName, description, setDescription, languageSetId, setLanguageSetId,
        selectedPhraseIds,
        phraseFilter, setPhraseFilter, categoryFilter, setCategoryFilter, loadingPhrases,
        config, setConfig, accessType, setAccessType, maxPlays, setMaxPlays,
        autoDeleteDays, setAutoDeleteDays, neverDelete, setNeverDelete, groups,
        selectedGroupIds, setSelectedGroupIds, manualUsernames, setManualUsernames,
        loadGroups, loadPhrases, handlePhraseToggle, filteredPhrases, availableCategories,
        resetForm, buildAccessPayload,
    } = form;

    const api = useTeacherApi({ setError });

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setActiveStep(0);
            resetForm(currentLanguageSetId || '');
            setGameType('word_search');
            setError('');

            // Load groups if private access is possible (or just always load to be ready)
            loadGroups();
        }
    }, [open, currentLanguageSetId]);

    // Load phrases when language set changes
    useEffect(() => {
        if (languageSetId && activeStep === 1) {
            loadPhrases();
        }
    }, [languageSetId, activeStep]);

    // Update config defaults when game type changes
    useEffect(() => {
        if (gameType === 'crossword') {
            setConfig(prev => ({
                ...prev,
                show_translations: true, // Crosswords typically use translations as clues
                require_translation_input: false, // Not used in crossword mode
            }));
        }
    }, [gameType]);

    const handleNext = () => {
        if (activeStep === 0) {
            if (!name.trim()) {
                setError(t('teacher.create.error_name_required', 'Name is required'));
                return;
            }
            if (!languageSetId) {
                setError(t('teacher.create.error_language_set_required', 'Please select a language set'));
                return;
            }
        }
        if (activeStep === 1) {
            if (selectedPhraseIds.length === 0) {
                setError(t('teacher.create.error_select_phrases', 'Please select at least one phrase'));
                return;
            }
        }
        setError('');
        setActiveStep(prev => prev + 1);
    };

    const handleBack = () => {
        setError('');
        setActiveStep(prev => prev - 1);
    };

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await api.createPhraseSet({
                name: name.trim(),
                description: description.trim() || null,
                language_set_id: parseInt(languageSetId),
                game_type: gameType,
                phrase_ids: selectedPhraseIds,
                config,
                ...buildAccessPayload(),
            });
            onCreated(result);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // State for lazy loading
    const [visibleCount, setVisibleCount] = useState(50);
    const listRef = React.useRef(null);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(50);
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [filteredPhrases]);

    const handleScroll = useCallback((e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        // Load more when scrolled to bottom (within 100px)
        if (scrollHeight - scrollTop - clientHeight < 100) {
            setVisibleCount(prev => {
                // Don't update if already showing all
                if (prev >= filteredPhrases.length) return prev;
                return prev + 50;
            });
        }
    }, [filteredPhrases.length]);

    // Visible subset of phrases
    const visiblePhrases = filteredPhrases.slice(0, visibleCount);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('teacher.create.title', 'Create Puzzle')}</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
                    {STEP_KEYS.map(labelKey => (
                        <Step key={labelKey}>
                            <StepLabel>{t(labelKey)}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Step 1: Basic Info */}
                {activeStep === 0 && (
                    <Stack spacing={3}>
                        <TextField
                            label={t('teacher.create.name_label', 'Puzzle Name')}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            fullWidth
                            required
                            slotProps={{ htmlInput: { maxLength: 255 } }}
                        />
                        <TextField
                            label={t('teacher.create.description_label', 'Description (optional)')}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                        />

                        <FormControl fullWidth>
                            <InputLabel>{t('game_type')}</InputLabel>
                            <Select
                                value={gameType}
                                onChange={e => setGameType(e.target.value)}
                                label={t('game_type')}
                            >
                                <MenuItem value="word_search">{t('gameType.word_search')}</MenuItem>
                                <MenuItem value="crossword">{t('gameType.crossword')}</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth required>
                            <InputLabel>{t('teacher.create.language_set_label', 'Language Set')}</InputLabel>
                            <Select
                                value={languageSetId}
                                onChange={e => setLanguageSetId(e.target.value)}
                                label={t('teacher.create.language_set_label', 'Language Set')}
                            >
                                {languageSets?.map(ls => (
                                    <MenuItem key={ls.id} value={ls.id}>
                                        {ls.display_name || ls.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Grid Size - moved here so teacher knows capacity upfront */}
                        <Box>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                                <Typography gutterBottom sx={{ mb: 0 }}>
                                    {t('teacher.create.grid_size_label', { size: config.grid_size, defaultValue: 'Grid Size: {{size}}x{{size}}' })}
                                </Typography>
                                <Chip
                                    label={t('teacher.create.max_phrases_hint', { count: Math.floor(config.grid_size * 2), defaultValue: 'Max ~{{count}} phrases' })}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                />
                            </Stack>
                            <Slider
                                value={config.grid_size}
                                onChange={(e, v) => setConfig({ ...config, grid_size: v })}
                                min={8}
                                max={20}
                                marks
                                valueLabelDisplay="auto"
                                sx={{ mt: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {t('teacher.create.grid_size_help', {
                                    min: Math.floor(config.grid_size * 1.2),
                                    max: Math.floor(config.grid_size * 2),
                                    defaultValue: 'Larger grids fit more phrases. Select {{min}} - {{max}} phrases for best results.'
                                })}
                            </Typography>
                        </Box>
                    </Stack>
                )}

                {/* Step 2: Select Phrases */}
                {activeStep === 1 && (
                    <Box>
                        <Stack direction="row" spacing={2} sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2" color="text.secondary">
                                {t('teacher.create.selected_count', { count: selectedPhraseIds.length, defaultValue: 'Selected: {{count}}/50 phrases' })}
                            </Typography>
                            <Stack direction="row" spacing={2}>
                                <FormControl size="small" sx={{ width: 150 }}>
                                    <InputLabel>{t('teacher.create.category_label', 'Category')}</InputLabel>
                                    <Select
                                        value={categoryFilter}
                                        label={t('teacher.create.category_label', 'Category')}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                    >
                                        <MenuItem value="">
                                            <em>{t('teacher.create.all_categories', 'All Categories')}</em>
                                        </MenuItem>
                                        {availableCategories.map(cat => (
                                            <MenuItem key={cat} value={cat}>
                                                {cat}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    placeholder={t('teacher.create.filter_placeholder', 'Filter phrases...')}
                                    value={phraseFilter}
                                    onChange={e => setPhraseFilter(e.target.value)}
                                    sx={{ width: 200 }}
                                />
                            </Stack>
                        </Stack>

                        {loadingPhrases ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <Box>
                                <List
                                    ref={listRef}
                                    onScroll={handleScroll}
                                    sx={{
                                        maxHeight: 400,
                                        overflow: 'auto',
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1
                                    }}
                                >
                                    {visiblePhrases.map(phrase => (
                                        <ListItemButton
                                            key={phrase.id}
                                            onClick={() => handlePhraseToggle(phrase.id)}
                                            selected={selectedPhraseIds.includes(phrase.id)}
                                            dense
                                        >
                                            <ListItemIcon>
                                                <Checkbox
                                                    checked={selectedPhraseIds.includes(phrase.id)}
                                                    edge="start"
                                                    disableRipple
                                                />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={phrase.phrase}
                                                secondary={phrase.translation}
                                            />
                                            {phrase.categories && (
                                                <Chip size="small" label={phrase.categories.split(' ')[0]} variant="outlined" />
                                            )}
                                        </ListItemButton>
                                    ))}

                                    {visiblePhrases.length < filteredPhrases.length && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('loading_more', 'Loading more...')}
                                            </Typography>
                                        </Box>
                                    )}

                                    {filteredPhrases.length === 0 && (
                                        <ListItemButton>
                                            <ListItemText
                                                primary={t('teacher.create.no_phrases_found', 'No phrases found')}
                                                secondary={t('teacher.create.try_different_filter', 'Try adjusting your filters')}
                                                sx={{ textAlign: 'center', py: 2 }}
                                            />
                                        </ListItemButton>
                                    )}
                                </List>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}>
                                    {t('teacher.create.showing_count', {
                                        shown: visiblePhrases.length,
                                        total: filteredPhrases.length,
                                        defaultValue: 'Showing {{shown}} of {{total}}'
                                    })}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Step 3: Configure */}
                {activeStep === 2 && (
                    <Stack spacing={3}>
                        <Typography variant="subtitle2">{t('teacher.create.game_options', 'Game Options')}</Typography>
                        <FormGroup>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.allow_hints}
                                        onChange={e => setConfig({ ...config, allow_hints: e.target.checked })}
                                    />
                                }
                                label={t('teacher.create.allow_hints', 'Allow hints')}
                            />
                            {gameType !== 'crossword' && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={config.show_translations}
                                            onChange={e => setConfig({ ...config, show_translations: e.target.checked })}
                                        />
                                    }
                                    label={t('teacher.create.show_translations', 'Show translations')}
                                />
                            )}

                            {gameType !== 'crossword' && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={config.require_translation_input}
                                            onChange={e => setConfig({ ...config, require_translation_input: e.target.checked })}
                                        />
                                    }
                                    label={t('teacher.create.require_translation_input', 'Require translation input')}
                                />
                            )}
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.show_timer}
                                        onChange={e => setConfig({ ...config, show_timer: e.target.checked })}
                                    />
                                }
                                label={t('teacher.create.show_timer', 'Show timer')}
                            />
                        </FormGroup>

                        <Typography variant="subtitle2" sx={{ mt: 2 }}>{t('teacher.create.access_settings', 'Access Settings')}</Typography>

                        <FormControl fullWidth>
                            <InputLabel>{t('teacher.create.access_type', 'Access Type')}</InputLabel>
                            <Select
                                value={accessType}
                                onChange={e => setAccessType(e.target.value)}
                                label={t('teacher.create.access_type', 'Access Type')}
                            >
                                <MenuItem value="public">{t('teacher.create.access_public', 'Public (anyone with link)')}</MenuItem>
                                <MenuItem value="private">{t('teacher.create.access_private', 'Private (login required)')}</MenuItem>
                            </Select>
                        </FormControl>

                        {accessType === 'private' && (
                            <FormControl fullWidth>
                                <InputLabel>{t('teacher.create.select_groups', 'Assign to Groups')}</InputLabel>
                                <Select
                                    multiple
                                    value={selectedGroupIds}
                                    onChange={(e) => setSelectedGroupIds(e.target.value)}
                                    label={t('teacher.create.select_groups', 'Assign to Groups')}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => {
                                                const group = groups.find(g => g.id === value);
                                                return <Chip key={value} label={group ? group.name : value} size="small" />;
                                            })}
                                        </Box>
                                    )}
                                >
                                    {groups.length === 0 ? (
                                        <MenuItem disabled value="">
                                            <em>{t('teacher.create.no_groups', 'No groups available')}</em>
                                        </MenuItem>
                                    ) : (
                                        groups.map((group) => (
                                            <MenuItem key={group.id} value={group.id}>
                                                {group.name} ({group.member_count} students)
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        )}

                        {accessType === 'private' && (
                            <TextField
                                label={t('teacher.create.manual_usernames', 'Assign to Studnets (by username)')}
                                placeholder={t('teacher.create.usernames_placeholder', 'Enter usernames separated by commas')}
                                value={manualUsernames}
                                onChange={e => setManualUsernames(e.target.value)}
                                helperText={t('teacher.create.usernames_helper', 'Individual students to invite')}
                                fullWidth
                            />
                        )}

                        <TextField
                            label={t('teacher.create.max_plays', 'Max Plays (optional)')}
                            type="number"
                            value={maxPlays}
                            onChange={e => setMaxPlays(e.target.value)}
                            helperText={t('teacher.create.max_plays_helper', 'Leave empty for unlimited plays')}
                            slotProps={{ htmlInput: { min: 1 } }}
                        />

                        <Box>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                                <Typography gutterBottom>
                                    {t('teacher.create.auto_delete_label', {
                                        days: neverDelete ? t('teacher.dashboard.never', 'Never') : t('teacher.dashboard.days', { count: autoDeleteDays }),
                                        defaultValue: 'Auto-delete after: {{days}}'
                                    })}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={neverDelete}
                                            onChange={e => setNeverDelete(e.target.checked)}
                                        />
                                    }
                                    label={t('teacher.create.do_not_delete', 'Do not delete')}
                                />
                            </Stack>
                            <Slider
                                value={autoDeleteDays}
                                onChange={(e, v) => setAutoDeleteDays(v)}
                                min={1}
                                max={90}
                                disabled={neverDelete}
                                marks={[
                                    { value: 7, label: '7d' },
                                    { value: 14, label: '14d' },
                                    { value: 30, label: '30d' },
                                    { value: 90, label: '90d' },
                                ]}
                            />
                        </Box>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>{t('cancel', 'Cancel')}</Button>
                {activeStep > 0 && (
                    <Button onClick={handleBack}>{t('previous', 'Back')}</Button>
                )}
                {activeStep < STEP_KEYS.length - 1 ? (
                    <Button onClick={handleNext} variant="contained">
                        {t('next', 'Next')}
                    </Button>
                ) : (
                    <Button onClick={handleCreate} variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : t('teacher.create.create_button', 'Create Puzzle')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default CreatePhraseSetDialog;
