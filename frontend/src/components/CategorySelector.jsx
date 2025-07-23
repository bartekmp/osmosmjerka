import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';

export default function CategorySelector({ categories, selected, onSelect }) {
    return (
        <Box sx={{ minWidth: 200 }}>
            <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                    value={selected}
                    label="Category"
                    onChange={e => onSelect(e.target.value)}
                >
                    {categories.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
