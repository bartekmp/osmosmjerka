import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CategorySelector from '../CategorySelector';
import { withI18n } from '../../../../../testUtils';

test('renders all categories and selects the correct one', () => {
    const categories = ['A', 'B', 'C'];
    const onSelect = jest.fn();
    render(withI18n(<CategorySelector categories={categories} selected="B" onSelect={onSelect} />));
    const select = screen.getByDisplayValue('B');
    fireEvent.change(select, { target: { value: 'C' } });
    expect(onSelect).toHaveBeenCalledWith('C');
});

test('disables selector when categories are unavailable', () => {
    const onSelect = jest.fn();
    render(withI18n(<CategorySelector categories={[]} selected="" onSelect={onSelect} />));
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-disabled', 'true');
});