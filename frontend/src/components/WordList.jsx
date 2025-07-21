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
                    style={{ width: buttonWidth, textAlign: 'center' }}
                >
                    {hideWords ? 'Show words' : 'Hide words'}
                </button>
                <button
                    className={`scrabble-btn word-list-toggle-translations`}
                    type="button"
                    onClick={() => canToggleTranslations && setShowTranslations(t => !t)}
                    disabled={!canToggleTranslations}
                    aria-label={showTranslations ? "Hide all translations" : "Show all translations"}
                >
                    {showTranslations ? '▼' : '▶'}
                </button>
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