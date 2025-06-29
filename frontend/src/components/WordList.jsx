import { useMemo } from 'react';
import './WordList.css';

export default function WordList({ words, found, hideWords, setHideWords, allFound }) {
    // Calculate the maximum length of translations to set a consistent width
    // This is done to ensure that the translation text does not wrap unnecessarily
    // and to maintain a clean layout for the word list.
    const maxTranslationLength = useMemo(() => (
        words.reduce((max, { translation }) =>
            translation && translation.length > max ? translation.length : max, 0)
    ), [words]);
    // Set a minimum width for the translation span based on the longest translation
    // Assuming an average character width of 0.65em, plus a small buffer
    // This ensures that the translation text does not wrap unnecessarily
    const translationMinWidth = `${maxTranslationLength * 0.65 + 1.5}em`;

    return (
        <div className="word-list-container">
            <div>
                <button
                    className="scrabble-btn word-list-hide-btn"
                    type="button"
                    onClick={() => setHideWords(h => !h)}
                    disabled={allFound}
                >
                    {hideWords ? 'Show words' : 'Hide words'}
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
                            {found.includes(word) ? translation : ''}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}