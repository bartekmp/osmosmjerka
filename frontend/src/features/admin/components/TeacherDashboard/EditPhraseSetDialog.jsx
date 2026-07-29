import React, { useState, useEffect } from 'react';
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

const STEP_KEYS = ['teacher.create.steps.select', 'teacher.create.steps.configure'];

/**
 * Dialog for editing an existing phrase set
 */
function EditPhraseSetDialog({ open, onClose, onUpdated, token, phraseSet }) {
    // Stepper state
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [error, setError] = useState('');

    const { t } = useTranslation();
    const form = usePhraseSetForm({ token, setError });
    const {
        name, setName, description, setDescription, languageSetId, setLanguageSetId,
        selectedPhraseIds, setSelectedPhraseIds,
        phraseFilter, setPhraseFilter, categoryFilter, setCategoryFilter, loadingPhrases,
        config, setConfig, accessType, setAccessType, maxPlays, setMaxPlays,
        autoDeleteDays, setAutoDeleteDays, neverDelete, setNeverDelete, groups,
        selectedGroupIds, setSelectedGroupIds, manualUsernames, setManualUsernames,
        loadGroups, loadPhrases, handlePhraseToggle, filteredPhrases, availableCategories,
        buildAccessPayload,
    } = form;

    const api = useTeacherApi({ setError });

    // Load data when dialog opens
    useEffect(() => {
        if (open && phraseSet) {
            loadSetDetails();
            loadGroups();
        }
    }, [open, phraseSet]);

    // Load phrases when language set changes
    useEffect(() => {
        if (languageSetId && activeStep === 0) {
            loadPhrases();
        }
    }, [languageSetId, activeStep]);

    const loadSetDetails = async () => {
        setInitialLoading(true);
        setActiveStep(0);
        setError('');
        try {
            const data = await api.getPhraseSet(phraseSet.id);

            // Populate form
            setName(data.name || '');
            setDescription(data.description || '');
            setLanguageSetId(data.language_set_id || '');

            // Phrases
            if (data.phrases) {
                setSelectedPhraseIds(data.phrases.map(p => p.id));
            }

            // Config
            if (data.config) {
                setConfig(prev => ({ ...prev, ...data.config }));
            }

            // Access
            setAccessType(data.access_type || 'public');
            setMaxPlays(data.max_plays ? data.max_plays.toString() : '');

            if (data.auto_delete_days === null && data.auto_delete_at === null) {
                setNeverDelete(true);
            } else {
                setNeverDelete(false);
                // Calculate days remaining? Or just use default/stored days preference?
                // The API doesn't return auto_delete_days stored configuration, it returns calculated date.
                // But for edit, we might want to let them reset it.
                // Assuming defaults 14 if not calculable.
                setAutoDeleteDays(14);
            }

            // Access Groups & Users
            setSelectedGroupIds(data.access_group_ids || []);
            if (data.access_usernames) {
                setManualUsernames(data.access_usernames.join(', '));
            } else {
                setManualUsernames('');
            }

        } catch {
            setError(t('teacher.edit.load_error', 'Failed to load puzzle details'));
        } finally {
            setInitialLoading(false);
        }
    };

    const handleNext = () => {
        if (activeStep === 0) {
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

    const handleUpdate = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await api.updatePhraseSet(phraseSet.id, {
                name: name.trim(),
                description: description.trim() || null,
                // language_set_id cannot be changed usually? Backend check?
                // teacher_sets.py says: "Only allows updating fields... For config/phrases updates, check if sessions exist first."
                // So we send everything, backend handles rules.

                // Oops, update logic in backend:
                // It takes kwargs.
                phrase_ids: selectedPhraseIds,
                config,
                expires_at: null, // Should be date if we support specific date
                ...buildAccessPayload(),
            });

            onUpdated(result);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('teacher.edit.title', 'Edit Puzzle')}</DialogTitle>
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



                {/* Step 2: Select Phrases */}
                {activeStep === 0 && (
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
                {activeStep === 1 && (
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
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={config.require_translation_input}
                                        onChange={e => setConfig({ ...config, require_translation_input: e.target.checked })}
                                    />
                                }
                                label={t('teacher.create.require_translation_input', 'Require translation input')}
                            />
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
                                                {group.name} ({t('teacher.groups.member_count', { count: group.member_count, defaultValue: '{{count}} students' })})
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        )}

                        {accessType === 'private' && (
                            <TextField
                                label={t('teacher.create.manual_usernames', 'Assign to Students (by username)')}
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
                    <Button onClick={handleUpdate} variant="contained" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : t('save', 'Save')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default EditPhraseSetDialog;
