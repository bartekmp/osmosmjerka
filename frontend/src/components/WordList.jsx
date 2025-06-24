import React from 'react';

export default function WordList({ words, found }) {
    return (
        <ul>
            {words.map(({ word, translation }) => (
                <li key={word}>
                    <span style={{ fontWeight: 'bold', textDecoration: found.includes(word) ? 'underline red' : 'none' }}>{word}</span> {found.includes(word) && `- ${translation}`}
                </li>
            ))}
        </ul>
    );
}