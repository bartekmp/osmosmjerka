import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Tooltip } from '@mui/material';
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
    languageSetId = null
}) {
    const { t } = useTranslation();
    const [blinkingPhrase, setBlinkingPhrase] = useState(null);
    const blinkTimeoutRef = useRef(null);
    const [selectedPhrases, setSelectedPhrases] = useState(new Set());

    // Fixed width for translation to prevent layout shifts
    // Instead of dynamic calculation, use a consistent width
    const translationMinWidth = "12em"; // Fixed width for stability

    const canToggleTranslations = found.length > 0 && !hidePhrases;

    // For consistent button width
    const buttonWidth = "7.2em";

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

    return (
        <div className="phrase-list-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        className="scrabble-btn phrase-list-hide-btn"
                        type="button"
                        onClick={() => setHidePhrases(h => !h)}
                        disabled={allFound || disableShowPhrases}
                        style={{ width: buttonWidth, textAlign: 'center', fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <span style={{ marginRight: 6 }}>{hidePhrases ? '👁️' : '🙈'}</span>
                        <span className="phrase-list-btn-label" style={{ display: 'none', sm: 'inline' }}>{hidePhrases ? t('show_phrases') : t('hide_phrases')}</span>
                        <span className="phrase-list-btn-label" style={{ display: 'inline', sm: 'none' }}>{hidePhrases ? t('show') : t('hide')}</span>
                    </button>
                    {/* Only render translation toggle if enabled */}
                    {canToggleTranslations && (
                        <button
                            className={`scrabble-btn phrase-list-toggle-translations`}
                            type="button"
                            onClick={() => setShowTranslations(t => !t)}
                            aria-label={showTranslations ? t('hide_all_translations') : t('show_all_translations')}
                            style={{ fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <span style={{ marginRight: 6 }}>{showTranslations ? '◀' : '▶'}</span>
                        </button>
                    )}
                    {/* Select All checkbox - only for logged-in users with found phrases */}
                    {currentUser && foundPhrases.length > 0 && (
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
                    )}
                </div>
                
                {/* Quick Add Buttons - Only for logged-in users */}
                {currentUser && foundPhrases.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
                    </div>
                )}
            </div>
            <ul className={`phrase-list-ul${hidePhrases ? ' blurred' : ''}`}>
                {phrases.map((phraseObj, index) => {
                    const { phrase, translation, id } = phraseObj;
                    const isFound = found.includes(phrase);
                    const isSelected = selectedPhrases.has(id);
                    
                    return (
                        <li className="phrase-list-li" key={`${phrase}-${index}`}>
                            {/* Checkbox - only for found phrases and logged-in users */}
                            {currentUser && isFound && id && (
                                <Checkbox
                                    size="small"
                                    checked={isSelected}
                                    onChange={() => togglePhraseSelection(id)}
                                    sx={{ 
                                        mr: 0.5,
                                        p: 0.25,
                                        '& .MuiSvgIcon-root': { fontSize: 18 }
                                    }}
                                />
                            )}
                            
                            <span 
                                className={`phrase-list-phrase${isFound ? ' found' : ''}${blinkingPhrase === phrase ? ' blinking' : ''}`}
                                onClick={() => handlePhraseClick(phrase)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handlePhraseClick(phrase);
                                    }
                                }}
                                onTouchEnd={e => { e.preventDefault(); handlePhraseClick(phrase); }}
                                style={{ cursor: progressiveHintsEnabled ? 'default' : 'pointer' }}
                                role="button"
                                tabIndex={progressiveHintsEnabled ? -1 : 0}
                                aria-label={`Highlight phrase: ${phrase}`}
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
        </div>
    );
}