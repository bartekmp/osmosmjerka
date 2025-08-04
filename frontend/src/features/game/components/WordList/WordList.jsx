import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './WordList.css';

export default function WordList({ words, found, hideWords, setHideWords, allFound, showTranslations, setShowTranslations, disableShowWords, onWordBlink }) {
    const { t } = useTranslation();
    const [blinkingWord, setBlinkingWord] = useState(null);
    const blinkTimeoutRef = useRef(null);

    // Fixed width for translation to prevent layout shifts
    // Instead of dynamic calculation, use a consistent width
    const translationMinWidth = "12em"; // Fixed width for stability

    const canToggleTranslations = found.length > 0 && !hideWords;

    // For consistent button width
    const buttonWidth = "7.2em";

    const handleWordClick = (word) => {
        // Clear any existing timeout
        if (blinkTimeoutRef.current) {
            clearTimeout(blinkTimeoutRef.current);
        }
        
        setBlinkingWord(word);
        
        // Also trigger grid blinking if callback is provided
        if (onWordBlink) {
            onWordBlink(word);
        }
        
        // Remove the blinking after 3 blinks (1.5 seconds)
        blinkTimeoutRef.current = setTimeout(() => {
            setBlinkingWord(null);
        }, 1500);
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
        <div className="word-list-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    className="scrabble-btn word-list-hide-btn"
                    type="button"
                    onClick={() => setHideWords(h => !h)}
                    disabled={allFound || disableShowWords}
                    style={{ width: buttonWidth, textAlign: 'center', fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <span style={{ marginRight: 6 }}>{hideWords ? '👁️' : '🙈'}</span>
                    <span className="word-list-btn-label" style={{ display: 'none', sm: 'inline' }}>{hideWords ? t('show_words') : t('hide_words')}</span>
                    <span className="word-list-btn-label" style={{ display: 'inline', sm: 'none' }}>{hideWords ? t('show') : t('hide')}</span>
                </button>
                {/* Only render translation toggle if enabled */}
                {canToggleTranslations && (
                    <button
                        className={`scrabble-btn word-list-toggle-translations`}
                        type="button"
                        onClick={() => setShowTranslations(t => !t)}
                        aria-label={showTranslations ? t('hide_all_translations') : t('show_all_translations')}
                        style={{ fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <span style={{ marginRight: 6 }}>{showTranslations ? '◀' : '▶'}</span>
                    </button>
                )}
            </div>
            <ul className={`word-list-ul${hideWords ? ' blurred' : ''}`}>
                {words.map(({ word, translation }) => (
                    <li className="word-list-li" key={word}>
                        <span 
                            className={`word-list-word${found.includes(word) ? ' found' : ''}${blinkingWord === word ? ' blinking' : ''}`}
                            onClick={() => handleWordClick(word)}
                            onTouchEnd={e => { e.preventDefault(); handleWordClick(word); }}
                            style={{ cursor: 'pointer' }}
                        >
                            {word}
                        </span>
                        <span
                            className={`word-list-translation${found.includes(word) ? ' found' : ''}`}
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