import React, { useMemo } from 'react';

export default function WordList({ words, found }) {
    // Calculate the maximum length of translations to set a consistent width
    // for the translation column, ensuring it accommodates the longest translation.
    // This is done to prevent the layout from shifting when different words are found.
    const maxTranslationLength = useMemo(() => (
        words.reduce((max, { translation }) =>
            translation && translation.length > max ? translation.length : max, 0)
    ), [words]);
    // Set a minimum width for the translation column based on the longest translation
    // to ensure that the layout remains consistent and readable.
    // The width is calculated as 65% of the longest translation length plus a small buffer
    const translationMinWidth = `${maxTranslationLength * 0.65 + 1.5}em`;

    return (
        <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: '2rem 0 0 0',
            textAlign: 'left',
            minWidth: '220px',
            maxWidth: '600px',
            width: '100%',
        }}>
            {words.map(({ word, translation }) => (
                <li
                    key={word}
                    style={{
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                    }}
                >
                    <span
                        style={{
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            textDecoration: found.includes(word) ? 'underline red' : 'none',
                            minWidth: '120px',
                            marginRight: '2.5em'
                        }}
                    >
                        {word}
                    </span>
                    <span
                        style={{
                            minWidth: translationMinWidth,
                            display: 'inline-block',
                            color: found.includes(word) ? 'inherit' : '#bbb',
                        }}
                    >
                        {found.includes(word) ? translation : ''}
                    </span>
                </li>
            ))}
        </ul>
    );
}