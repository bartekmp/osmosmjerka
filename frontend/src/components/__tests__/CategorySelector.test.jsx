import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CategorySelector from '../CategorySelector';
import { withI18n } from '../../testUtils';

test('renders all categories and selects the correct one', () => {
    const categories = ['A', 'B', 'C'];
    const onSelect = jest.fn();
    render(withI18n(<CategorySelector categories={categories} selected="B" onSelect={onSelect} />));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
    const input = screen.getByDisplayValue('B');
    fireEvent.change(input, { target: { value: 'C' } });
    expect(onSelect).toHaveBeenCalledWith('C');
});