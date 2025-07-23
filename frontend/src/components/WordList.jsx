import React from 'react';
import './WordList.css';

export default function WordList({ words, found, hideWords, setHideWords, allFound, showTranslations, setShowTranslations, disableShowWords }) {
    // Fixed width for translation to prevent layout shifts
    // Instead of dynamic calculation, use a consistent width
    const translationMinWidth = "12em"; // Fixed width for stability

    const canToggleTranslations = found.length > 0 && !hideWords;

    // For consistent button width
    const buttonWidth = "7.2em";

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
                    <span className="word-list-btn-label" style={{ display: 'none', sm: 'inline' }}>{hideWords ? 'Show words' : 'Hide words'}</span>
                    <span className="word-list-btn-label" style={{ display: 'inline', sm: 'none' }}>{hideWords ? 'Show' : 'Hide'}</span>
                </button>
                {/* Only render translation toggle if enabled */}
                {canToggleTranslations && (
                    <button
                        className={`scrabble-btn word-list-toggle-translations`}
                        type="button"
                        onClick={() => setShowTranslations(t => !t)}
                        aria-label={showTranslations ? "Hide all translations" : "Show all translations"}
                        style={{ fontSize: '1.3em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <span style={{ marginRight: 6 }}>{showTranslations ? '◀🔤' : '🔤🌐▶'}</span>
                    </button>
                )}
            </div>
            <ul className={`word-list-ul${hideWords ? ' blurred' : ''}`}>
                {words.map(({ word, translation }) => (
                    <li className="word-list-li" key={word}>
                        <span className={`word-list-word${found.includes(word) ? ' found' : ''}`}>
                            {word}
                        </span>
                        <span
                            className={`word-list-translation${found.includes(word) ? ' found' : ''}`}
                            style={{ minWidth: translationMinWidth }}
                        >
                            {showTranslations ? translation : ''}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}