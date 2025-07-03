import React from 'react';
import './CategorySelector.css';

export default function CategorySelector({ categories, selected, onSelect }) {
    return (
        <label className="category-selector-label">
            Category:&nbsp;
            <select value={selected} onChange={e => onSelect(e.target.value)}>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </label>
    );
}
