import React from 'react';

export default function CategorySelector({ categories, onSelect }) {
  return (
    <select onChange={e => onSelect(e.target.value)}>
      {categories.map(cat => <option key={cat}>{cat}</option>)}
    </select>
  );
}
