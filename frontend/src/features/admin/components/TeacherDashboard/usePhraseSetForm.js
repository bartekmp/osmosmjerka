import { authHeaders } from '@shared/utils/apiClient';
import { useCallback, useMemo, useState } from 'react';
import { useGroups } from './useGroups';

export const DEFAULT_CONFIG = {
    allow_hints: true,
    show_translations: true,
    require_translation_input: false,
    show_timer: false,
    strict_grid_size: false,
    grid_size: 10,
    difficulty: 'medium',
};

/** Hard cap enforced while picking phrases. */
export const MAX_SELECTED_PHRASES = 50;

/**
 * Form state shared by the create and edit phrase-set dialogs.
 *
 * The two dialogs differ in their step count, their submit call and (for edit) loading
 * an existing set, but everything below was duplicated between them verbatim: the same
 * nineteen pieces of state, the same phrase/group loaders, the same selection toggle and
 * the same filter predicate.
 *
 * Callers keep their own `error`/`loading` handling and pass setError in, because the
 * edit dialog also drives it from its initial fetch.
 */
export function usePhraseSetForm({ setError }) {
    // Basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [languageSetId, setLanguageSetId] = useState('');

    // Phrase selection
    const [availablePhrases, setAvailablePhrases] = useState([]);
    const [selectedPhraseIds, setSelectedPhraseIds] = useState([]);
    const [phraseFilter, setPhraseFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [loadingPhrases, setLoadingPhrases] = useState(false);

    // Configuration
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [accessType, setAccessType] = useState('public');
    const [maxPlays, setMaxPlays] = useState('');
    const [autoDeleteDays, setAutoDeleteDays] = useState(14);
    const [neverDelete, setNeverDelete] = useState(false);

    // Group access
    const [groups, setGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [manualUsernames, setManualUsernames] = useState('');

    const groupsApi = useGroups({ setError });

    const loadGroups = useCallback(async () => {
        try {
            setGroups(await groupsApi.fetchGroups());
        } catch {
            // Ignored: the teacher may simply have no groups yet.
        }
    }, [groupsApi]);

    const loadPhrases = useCallback(async () => {
        setLoadingPhrases(true);
        try {
            const response = await fetch(`/admin/rows?language_set_id=${languageSetId}&limit=500`, {
                headers: authHeaders(),
            });
            const data = await response.json();
            setAvailablePhrases(data.rows || []);
        } catch {
            setError('Failed to load phrases');
        } finally {
            setLoadingPhrases(false);
        }
    }, [languageSetId, setError]);

    const handlePhraseToggle = useCallback((phraseId) => {
        setSelectedPhraseIds(prev => {
            if (prev.includes(phraseId)) {
                return prev.filter(id => id !== phraseId);
            }
            if (prev.length >= MAX_SELECTED_PHRASES) {
                return prev;
            }
            return [...prev, phraseId];
        });
    }, []);

    const filteredPhrases = useMemo(() => availablePhrases.filter(p => {
        if (phraseFilter) {
            const search = phraseFilter.toLowerCase();
            const matchesText = (
                p.phrase?.toLowerCase().includes(search) ||
                p.translation?.toLowerCase().includes(search) ||
                p.categories?.toLowerCase().includes(search)
            );
            if (!matchesText) return false;
        }
        if (categoryFilter) {
            const phraseCategories = p.categories ? p.categories.split(' ') : [];
            if (!phraseCategories.includes(categoryFilter)) return false;
        }
        return true;
    }), [availablePhrases, phraseFilter, categoryFilter]);

    /** Reset every shared field. Callers reset their own extras (step index, game type). */
    const resetForm = useCallback((languageSetIdDefault = '') => {
        setName('');
        setDescription('');
        setLanguageSetId(languageSetIdDefault);
        setSelectedPhraseIds([]);
        setPhraseFilter('');
        setCategoryFilter('');
        setConfig(DEFAULT_CONFIG);
        setAccessType('public');
        setMaxPlays('');
        setAutoDeleteDays(14);
        setNeverDelete(false);
        setSelectedGroupIds([]);
        setManualUsernames('');
    }, []);

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

    /** The access/expiry half of the submit payload, built identically by both dialogs.
     *  Note the empty cases are `undefined`, not `[]` - the backend distinguishes
     *  "not supplied" from "explicitly empty", so this shape is preserved exactly. */
    const buildAccessPayload = useCallback(() => {
        const parsedUsernames = manualUsernames.trim()
            ? manualUsernames.split(',').map(u => u.trim()).filter(u => u)
            : [];
        return {
            access_type: accessType,
            max_plays: maxPlays ? parseInt(maxPlays, 10) : null,
            auto_delete_days: neverDelete ? null : autoDeleteDays,
            access_group_ids: accessType === 'private' && selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
            access_usernames: accessType === 'private' && parsedUsernames.length > 0 ? parsedUsernames : undefined,
        };
    }, [accessType, maxPlays, neverDelete, autoDeleteDays, selectedGroupIds, manualUsernames]);

    return {
        name, setName,
        description, setDescription,
        languageSetId, setLanguageSetId,
        availablePhrases, setAvailablePhrases,
        selectedPhraseIds, setSelectedPhraseIds,
        phraseFilter, setPhraseFilter,
        categoryFilter, setCategoryFilter,
        loadingPhrases,
        config, setConfig,
        accessType, setAccessType,
        maxPlays, setMaxPlays,
        autoDeleteDays, setAutoDeleteDays,
        neverDelete, setNeverDelete,
        groups,
        selectedGroupIds, setSelectedGroupIds,
        manualUsernames, setManualUsernames,
        loadGroups,
        loadPhrases,
        handlePhraseToggle,
        filteredPhrases,
        availableCategories,
        resetForm,
        buildAccessPayload,
    };
}

export default usePhraseSetForm;
