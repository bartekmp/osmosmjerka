import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CategorySelector from '../CategorySelector';

test('renders all categories and selects the correct one', () => {
    const categories = ['A', 'B', 'C'];
    const onSelect = jest.fn();
    render(<CategorySelector categories={categories} selected="B" onSelect={onSelect} />);
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'C' } });
    expect(onSelect).toHaveBeenCalledWith('C');
});