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

test('renders ALL category and translates it correctly', () => {
    const categories = ['ALL', 'A', 'B', 'C'];
    const onSelect = jest.fn();
    render(withI18n(<CategorySelector categories={categories} selected="ALL" onSelect={onSelect} />));

    // Check that ALL is displayed (translated)
    const select = screen.getByDisplayValue(/all/i);
    expect(select).toBeInTheDocument();

    // Check that ALL option exists in the dropdown
    fireEvent.mouseDown(select);
    const allOption = screen.getByText(/all/i);
    expect(allOption).toBeInTheDocument();
});

test('handles ALL category selection', () => {
    const categories = ['ALL', 'A', 'B'];
    const onSelect = jest.fn();
    render(withI18n(<CategorySelector categories={categories} selected="A" onSelect={onSelect} />));

    const select = screen.getByDisplayValue('A');
    fireEvent.change(select, { target: { value: 'ALL' } });
    expect(onSelect).toHaveBeenCalledWith('ALL');
});

test('displays translated ALL category in renderValue', () => {
    const categories = ['ALL', 'A', 'B'];
    const onSelect = jest.fn();
    const { _ } = render(withI18n(<CategorySelector categories={categories} selected="ALL" onSelect={onSelect} />));

    // The renderValue should show the translated "ALL"
    const select = screen.getByDisplayValue('ALL');
    expect(select).toBeInTheDocument();
});