import React from 'react';
import { render, screen } from '@testing-library/react';
import GameControls from '../GameControls';
import { withI18n } from '../../../../../testUtils';

jest.mock('../../../../../shared', () => {
    const actual = jest.requireActual('../../../../../shared');
    return {
        ...actual,
        LanguageSetSelector: ({ selectedLanguageSetId }) => (
            <div data-testid="language-set-selector">Lang:{selectedLanguageSetId ?? 'none'}</div>
        ),
        ResponsiveText: ({ desktop, mobile }) => <>{desktop || mobile}</>
    };
});

describe('GameControls disabled states', () => {
    const baseProps = {
        panelOpen: true,
        setPanelOpen: jest.fn(),
        visibleCategories: ['Animals'],
        selectedCategory: 'Animals',
        setSelectedCategory: jest.fn(),
        difficulty: 'easy',
        setDifficulty: jest.fn(),
        availableDifficulties: [{ value: 'easy' }],
        refreshPuzzle: jest.fn(),
        selectedCategoryState: 'Animals',
        difficultyState: 'easy',
        grid: [],
        phrases: [],
        isLoading: false,
        notEnoughPhrases: false,
        selectedLanguageSetId: 1,
        onLanguageSetChange: jest.fn()
    };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    const renderControls = (overrideProps = {}) =>
        render(withI18n(<GameControls {...baseProps} {...overrideProps} />));

    test('disables category, difficulty, and refresh when language set is missing', () => {
        renderControls({ selectedLanguageSetId: null });

        const [categorySelect, difficultySelect] = screen.getAllByRole('combobox');
        const refreshButton = screen.getByTitle(/reload puzzle/i);

        expect(categorySelect).toHaveAttribute('aria-disabled', 'true');
        expect(difficultySelect).toHaveAttribute('aria-disabled', 'true');
        expect(refreshButton).toBeDisabled();
    });

    test('disables controls when no categories are available', () => {
        renderControls({ visibleCategories: [], selectedCategory: '', selectedCategoryState: '' });

        const [categorySelect, difficultySelect] = screen.getAllByRole('combobox');
        const refreshButton = screen.getByTitle(/reload puzzle/i);

        expect(categorySelect).toHaveAttribute('aria-disabled', 'true');
        expect(difficultySelect).toHaveAttribute('aria-disabled', 'true');
        expect(refreshButton).toBeDisabled();
    });

    test('disables refresh when no category is selected', () => {
        renderControls({ selectedCategory: '', selectedCategoryState: '' });

        const [categorySelect] = screen.getAllByRole('combobox');
        const refreshButton = screen.getByTitle(/reload puzzle/i);

        expect(categorySelect).not.toHaveAttribute('aria-disabled', 'true');
        expect(refreshButton).toBeDisabled();
    });

    test('enables controls when language set and categories are available', () => {
        renderControls();

        const [categorySelect, difficultySelect] = screen.getAllByRole('combobox');
        const refreshButton = screen.getByTitle(/reload puzzle/i);

        expect(categorySelect).not.toHaveAttribute('aria-disabled', 'true');
        expect(difficultySelect).not.toHaveAttribute('aria-disabled', 'true');
        expect(refreshButton).not.toBeDisabled();
    });
});
