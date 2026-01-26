import React, { useState, useEffect, useMemo } from 'react';
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
import { useGroups } from './useGroups';

const STEP_KEYS = ['teacher.create.steps.basic', 'teacher.create.steps.select', 'teacher.create.steps.configure'];

/**
 * Dialog for creating a new phrase set
 */
function CreatePhraseSetDialog({ open, onClose, onCreated, token, languageSets, currentLanguageSetId }) {
    // Stepper state
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form state - Step 1: Basic Info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [languageSetId, setLanguageSetId] = useState(currentLanguageSetId || '');
    const [gameType, setGameType] = useState('word_search');

    // Form state - Step 2: Phrases (phrases loaded from API)
    const [availablePhrases, setAvailablePhrases] = useState([]);
    const [selectedPhraseIds, setSelectedPhraseIds] = useState([]);
    const [phraseFilter, setPhraseFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [loadingPhrases, setLoadingPhrases] = useState(false);

    // Form state - Step 3: Configuration
    const [config, setConfig] = useState({
        allow_hints: true,
        show_translations: true,
        require_translation_input: false,
        show_timer: false,
        strict_grid_size: false,
        grid_size: 10,
        difficulty: 'medium',
    });
    const [accessType, setAccessType] = useState('public');
    const [maxPlays, setMaxPlays] = useState('');
    const [autoDeleteDays, setAutoDeleteDays] = useState(14);

    const [neverDelete, setNeverDelete] = useState(false);

    // Group selection state
    const [groups, setGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [manualUsernames, setManualUsernames] = useState('');

    const { t } = useTranslation();
    const api = useTeacherApi({ token, setError });
    const groupsApi = useGroups({ token, setError });

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setActiveStep(0);
            setName('');
            setDescription('');
            setLanguageSetId(currentLanguageSetId || '');
            setGameType('word_search');
            setSelectedPhraseIds([]);
            setPhraseFilter('');
            setCategoryFilter('');
            setConfig({
                allow_hints: true,
                show_translations: true,
                require_translation_input: false,
                show_timer: false,
                strict_grid_size: false,
                grid_size: 10,
                difficulty: 'medium',
            });
            setAccessType('public');
            setMaxPlays('');
            setAutoDeleteDays(14);
            setNeverDelete(false);
            setMaxPlays('');
            setAutoDeleteDays(14);
            setNeverDelete(false);
            setSelectedGroupIds([]);
            setManualUsernames('');
            setError('');

            // Load groups if private access is possible (or just always load to be ready)
            loadGroups();
        }
    }, [open, currentLanguageSetId]);

    const loadGroups = async () => {
        try {
            const data = await groupsApi.fetchGroups();
            setGroups(data);
        } catch {
            // Ignore (maybe teacher has no groups yet or error handled globally)
        }
    };

    // Load phrases when language set changes
    useEffect(() => {
        if (languageSetId && activeStep === 1) {
            loadPhrases();
        }
    }, [languageSetId, activeStep]);

    const loadPhrases = async () => {
        setLoadingPhrases(true);
        try {
            // Fetch phrases from admin API
            const response = await fetch(`/admin/rows?language_set_id=${languageSetId}&limit=500`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setAvailablePhrases(data.rows || []);
        } catch {
            setError('Failed to load phrases');
        } finally {
            setLoadingPhrases(false);
        }
    };

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

    const handlePhraseToggle = (phraseId) => {
        setSelectedPhraseIds(prev => {
            if (prev.includes(phraseId)) {
                return prev.filter(id => id !== phraseId);
            }
            if (prev.length >= 50) {
                return prev; // Max 50 phrases
            }
            return [...prev, phraseId];
        });
    };

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
            let parsedUsernames = [];
            if (manualUsernames.trim()) {
                parsedUsernames = manualUsernames.split(',').map(u => u.trim()).filter(u => u);
            }

            const result = await api.createPhraseSet({
                name: name.trim(),
                description: description.trim() || null,
                language_set_id: parseInt(languageSetId),
                game_type: gameType,
                phrase_ids: selectedPhraseIds,
                config,
                access_type: accessType,
                max_plays: maxPlays ? parseInt(maxPlays) : null,
                auto_delete_days: neverDelete ? null : autoDeleteDays,
                access_group_ids: accessType === 'private' && selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
                access_usernames: accessType === 'private' && parsedUsernames.length > 0 ? parsedUsernames : undefined,
            });
            onCreated(result);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const availableCategories = useMemo(() => {
        const categories = new Set();
        availablePhrases.forEach(p => {
            if (p.categories) {
                p.categories.split(' ').forEach(c => {
                    if (c.trim()) categories.add(c.trim());
                });
            }
        });
        return Array.from(categories).sort();
    }, [availablePhrases]);

    const filteredPhrases = availablePhrases.filter(p => {
        // Text filter
        if (phraseFilter) {
            const search = phraseFilter.toLowerCase();
            const matchesText = (
                p.phrase?.toLowerCase().includes(search) ||
                p.translation?.toLowerCase().includes(search) ||
                p.categories?.toLowerCase().includes(search)
            );
            if (!matchesText) return false;
        }

        // Category filter
        if (categoryFilter) {
            const phraseCategories = p.categories ? p.categories.split(' ') : [];
            if (!phraseCategories.includes(categoryFilter)) return false;
        }

        return true;
    });

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
                            inputProps={{ maxLength: 255 }}
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
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
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
                                    defaultValue: '💡 Larger grids fit more phrases. Select {{min}} - {{max}} phrases for best results.'
                                })}
                            </Typography>
                        </Box>
                    </Stack>
                )}

                {/* Step 2: Select Phrases */}
                {activeStep === 1 && (
                    <Box>
                        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
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
                            <List sx={{ maxHeight: 400, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                {filteredPhrases.map(phrase => (
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
                            </List>
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
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.show_translations}
                                        onChange={e => setConfig({ ...config, show_translations: e.target.checked })}
                                    />
                                }
                                label={t('teacher.create.show_translations', 'Show translations')}
                            />

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
                            inputProps={{ min: 1 }}
                        />

                        <Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
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
