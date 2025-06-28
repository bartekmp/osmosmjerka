import React from 'react';

export default function CategorySelector({ categories, selected, onSelect }) {
    return (
        <label>
            Category:&nbsp;
            <select value={selected} onChange={e => onSelect(e.target.value)}>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </label>
    );
}
