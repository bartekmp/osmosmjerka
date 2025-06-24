import React from 'react';

export default function WordList({ words, found }) {
  return (
    <ul>
      {words.map(({ word, translation }) => (
        <li key={word} style={{ textDecoration: found.includes(word) ? 'line-through' : 'none' }}>
          {word} {found.includes(word) && `- ${translation}`}
        </li>
      ))}
    </ul>
  );
}