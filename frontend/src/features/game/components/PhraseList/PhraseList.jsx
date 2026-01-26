import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Tooltip, Box, Typography } from '@mui/material';
import AddToLearnLaterButton from '../AddToLearnLaterButton';
import './PhraseList.css';

export default function PhraseList({
    phrases,
    found,
    hidePhrases,
    setHidePhrases,
    allFound,
    showTranslations,
    setShowTranslations,
    disableShowPhrases,
    onPhraseClick,
    progressiveHintsEnabled = false,
    currentUser = null,
    languageSetId = null,
    hideToggleButton = false,
    compact = false,
    gameType = "word_search"
}) {
    const { t } = useTranslation();
    const [blinkingPhrase, setBlinkingPhrase] = useState(null);
    const blinkTimeoutRef = useRef(null);
    const [selectedPhrases, setSelectedPhrases] = useState(new Set());

    // Fixed width for translation to prevent layout shifts
    // Instead of dynamic calculation, use a consistent width
    const translationMinWidth = "12em"; // Fixed width for stability

    // Don't show translation toggle in crossword mode (translations are always shown as clues)
    const isCrossword = gameType === "crossword";
    const canToggleTranslations = setShowTranslations && found.length > 0 && !hidePhrases && !isCrossword;

    // For consistent button width
    const buttonWidth = compact ? "5em" : "7.2em";

    const handlePhraseClick = (phrase) => {
        // Only allow phrase clicking when progressive hints are disabled
        if (!progressiveHintsEnabled) {
            // Clear any existing timeout
            if (blinkTimeoutRef.current) {
                clearTimeout(blinkTimeoutRef.current);
            }

            setBlinkingPhrase(phrase);

            // Also trigger grid blinking if callback is provided
            if (onPhraseClick) {
                onPhraseClick(phrase);
            }

            // Remove the blinking after 3 blinks (1.5 seconds)
            blinkTimeoutRef.current = setTimeout(() => {
                setBlinkingPhrase(null);
            }, 1500);
        }
    };

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (blinkTimeoutRef.current) {
                clearTimeout(blinkTimeoutRef.current);
            }
        };
    }, []);

    // Get found phrases with their full data (including id)
    const foundPhrases = phrases.filter(p => found.includes(p.phrase));

    // Toggle phrase selection
    const togglePhraseSelection = (phraseId) => {
        setSelectedPhrases(prev => {
            const newSet = new Set(prev);
            if (newSet.has(phraseId)) {
                newSet.delete(phraseId);
            } else {
                newSet.add(phraseId);
            }
            return newSet;
        });
    };

    // Select/deselect all found phrases
    const toggleSelectAll = () => {
        if (selectedPhrases.size === foundPhrases.length) {
            setSelectedPhrases(new Set());
        } else {
            setSelectedPhrases(new Set(foundPhrases.map(p => p.id).filter(Boolean)));
        }
    };

    const selectedFoundPhrases = foundPhrases.filter(p => selectedPhrases.has(p.id));
    const hasSelection = selectedPhrases.size > 0;
    const allSelectedInFound = foundPhrases.length > 0 &&
        selectedPhrases.size === foundPhrases.length;

    // For crossword mode, group phrases by direction (isCrossword already defined above)
    const acrossPhrases = isCrossword ? phrases.filter(p => p.direction === "across") : [];
    const downPhrases = isCrossword ? phrases.filter(p => p.direction === "down") : [];

    // Helper to check if phrase is found (supports both string and object found arrays)
    const isPhraseFound = (phraseObj) => {
        const phraseText = phraseObj.phrase;
        return found.some(f =>
            (typeof f === 'string' ? f : f?.phrase) === phraseText
        );
    };

    return (
        <div className="phrase-list-container">
            {/* Top row: Hide/Show and Translation toggle buttons */}
            {!hideToggleButton && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button
                        className="scrabble-btn phrase-list-hide-btn"
                        type="button"
                        onClick={() => setHidePhrases(h => !h)}
                        disabled={allFound || disableShowPhrases}
                        style={{
                            width: buttonWidth,
                            textAlign: 'center',
                            fontSize: compact ? '0.95em' : '1.1em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: compact ? '6px 8px' : undefined
                        }}
                    >
                        <span style={{ marginRight: compact ? 4 : 6 }}>{hidePhrases ? '👁️' : '🙈'}</span>
                        <span className="phrase-list-btn-label">
                            {found.length}/{phrases.length}
                        </span>
                    </button>
                    {/* Only render translation toggle if enabled */}
                    {canToggleTranslations && (
                        <button
                            className={`scrabble-btn phrase-list-toggle-translations`}
                            type="button"
                            onClick={() => setShowTranslations(t => !t)}
                            aria-label={showTranslations ? t('hide_all_translations') : t('show_all_translations')}
                            style={{
                                fontSize: compact ? '0.95em' : '1.1em',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: compact ? '6px 12px' : undefined
                            }}
                        >
                            <span style={{ marginRight: compact ? 4 : 6 }}>{showTranslations ? '◀' : '▶'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Selection controls frame - only for logged-in users with found phrases */}
            {currentUser && foundPhrases.length > 0 && (
                <Box
                    sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.5,
                        mb: 2,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexWrap: 'wrap'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip
                            title={allSelectedInFound ? t('learnLater.deselect_all') : t('learnLater.select_all_found')}
                            placement="top"
                            arrow
                        >
                            <Checkbox
                                size="small"
                                checked={allSelectedInFound}
                                indeterminate={hasSelection && !allSelectedInFound}
                                onChange={toggleSelectAll}
                                sx={{ p: 0.5 }}
                            />
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary">
                            {allSelectedInFound ? t('learnLater.deselect_all') : t('learnLater.select_all_found')}
                        </Typography>
                    </Box>

                    {/* Add buttons */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
                        {/* Add Selected Button - only shows when phrases are selected */}
                        {hasSelection && (
                            <AddToLearnLaterButton
                                type="selected"
                                phrases={selectedFoundPhrases}
                                languageSetId={languageSetId}
                                currentUser={currentUser}
                                onSuccess={() => {
                                    // Optionally clear selection after adding
                                    setSelectedPhrases(new Set());
                                }}
                            />
                        )}

                        {/* Add All Button */}
                        <AddToLearnLaterButton
                            type="all"
                            phrases={foundPhrases}
                            languageSetId={languageSetId}
                            currentUser={currentUser}
                            disabled={foundPhrases.length === 0}
                        />
                    </Box>

                </Box>
            )}

            {/* Crossword mode: show numbered clues grouped by Across/Down */}
            {isCrossword ? (
                <div className={`phrase-list-crossword${hidePhrases ? ' blurred' : ''}`}>
                    {/* Across clues */}
                    {acrossPhrases.length > 0 && (
                        <div className="crossword-clue-section">
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {t('crossword.across')}
                            </Typography>
                            <ul className="crossword-clue-list">
                                {acrossPhrases.map((phraseObj, index) => {
                                    const { phrase, translation, start_number } = phraseObj;
                                    const isFound = isPhraseFound(phraseObj);
                                    return (
                                        <li
                                            key={`across-${index}`}
                                            className={`crossword-clue-item${isFound ? ' found' : ''}`}
                                            onClick={() => !isFound && onPhraseClick?.(phrase)}
                                            style={{ cursor: isFound ? 'default' : 'pointer' }}
                                        >
                                            <span className="crossword-clue-number">{start_number}.</span>
                                            <span className="crossword-clue-text">
                                                {translation || phrase}
                                            </span>
                                            {isFound && (
                                                <span className="crossword-clue-answer">
                                                    ({phrase})
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Down clues */}
                    {downPhrases.length > 0 && (
                        <div className="crossword-clue-section">
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                                {t('crossword.down')}
                            </Typography>
                            <ul className="crossword-clue-list">
                                {downPhrases.map((phraseObj, index) => {
                                    const { phrase, translation, start_number } = phraseObj;
                                    const isFound = isPhraseFound(phraseObj);
                                    return (
                                        <li
                                            key={`down-${index}`}
                                            className={`crossword-clue-item${isFound ? ' found' : ''}`}
                                            onClick={() => !isFound && onPhraseClick?.(phrase)}
                                            style={{ cursor: isFound ? 'default' : 'pointer' }}
                                        >
                                            <span className="crossword-clue-number">{start_number}.</span>
                                            <span className="crossword-clue-text">
                                                {translation || phrase}
                                            </span>
                                            {isFound && (
                                                <span className="crossword-clue-answer">
                                                    ({phrase})
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                /* Word search mode: original phrase list */
                <ul className={`phrase-list-ul${hidePhrases ? ' blurred' : ''}`}>
                    {phrases.map((phraseObj, index) => {
                        const { phrase, translation, id } = phraseObj;
                        const isFound = found.includes(phrase);
                        const isSelected = selectedPhrases.has(id);

                        return (
                            <li className="phrase-list-li" key={`${phrase}-${index}`}>
                                <span
                                    className={`phrase-list-phrase${isFound ? ' found' : ''}${blinkingPhrase === phrase ? ' blinking' : ''}${isSelected ? ' selected' : ''}`}
                                    onClick={() => {
                                        if (currentUser && isFound && id) {
                                            togglePhraseSelection(id);
                                        } else if (!progressiveHintsEnabled) {
                                            handlePhraseClick(phrase);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if (currentUser && isFound && id) {
                                                togglePhraseSelection(id);
                                            } else if (!progressiveHintsEnabled) {
                                                handlePhraseClick(phrase);
                                            }
                                        }
                                    }}
                                    onTouchEnd={e => {
                                        e.preventDefault();
                                        if (currentUser && isFound && id) {
                                            togglePhraseSelection(id);
                                        } else if (!progressiveHintsEnabled) {
                                            handlePhraseClick(phrase);
                                        }
                                    }}
                                    style={{
                                        cursor: progressiveHintsEnabled ? 'default' : 'pointer',
                                        display: 'inline-block'
                                    }}
                                    role="button"
                                    tabIndex={progressiveHintsEnabled ? -1 : 0}
                                    aria-label={isSelected ? `Selected: ${phrase}` : `Highlight phrase: ${phrase}`}
                                >
                                    {phrase}
                                </span>
                                <span
                                    className={`phrase-list-translation${isFound ? ' found' : ''}`}
                                    style={{
                                        minWidth: translationMinWidth,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {showTranslations ? (translation || '').replace(/<br\s*\/?>/gi, '\n') : ''}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}