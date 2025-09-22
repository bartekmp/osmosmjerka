import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './PhraseList.css';

export default function PhraseList({ phrases, found, hidePhrases, setHidePhrases, allFound, showTranslations, setShowTranslations, disableShowPhrases, onPhraseClick, progressiveHintsEnabled = false }) {
    const { t } = useTranslation();
    const [blinkingPhrase, setBlinkingPhrase] = useState(null);
    const blinkTimeoutRef = useRef(null);

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

    return (
        <div className="phrase-list-container">
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
            </div>
            <ul className={`phrase-list-ul${hidePhrases ? ' blurred' : ''}`}>
                {phrases.map(({ phrase, translation }, index) => (
                    <li className="phrase-list-li" key={`${phrase}-${index}`}>
                        <span 
                            className={`phrase-list-phrase${found.includes(phrase) ? ' found' : ''}${blinkingPhrase === phrase ? ' blinking' : ''}`}
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
                            className={`phrase-list-translation${found.includes(phrase) ? ' found' : ''}`}
                            style={{ 
                                minWidth: translationMinWidth,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        >
                            {showTranslations ? (translation || '').replace(/<br\s*\/?>/gi, '\n') : ''}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}