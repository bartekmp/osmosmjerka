import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import GameTypeSelector from '../GameTypeSelector';

// Create a basic theme for testing
const theme = createTheme();

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => fallback || key,
    }),
}));

const renderSelector = (props = {}) => {
    const defaultProps = {
        currentType: 'word_search',
        onChange: jest.fn(),
        disabled: false,
        ...props,
    };

    return render(
        <ThemeProvider theme={theme}>
            <GameTypeSelector {...defaultProps} />
        </ThemeProvider>
    );
};

describe('GameTypeSelector', () => {
    test('renders button with default word_search type', () => {
        renderSelector();
        const button = screen.getByRole('button', { name: /select game type/i });
        expect(button).toBeInTheDocument();
    });

    test('renders button with crossword type', () => {
        renderSelector({ currentType: 'crossword' });
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('title', 'Crossword');
    });

    test('opens menu on button click', () => {
        renderSelector();
        const button = screen.getByRole('button');

        fireEvent.click(button);

        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByText('Word Search')).toBeInTheDocument();
        expect(screen.getByText('Crossword')).toBeInTheDocument();
    });

    test('calls onChange when selecting different type', () => {
        const onChange = jest.fn();
        renderSelector({ currentType: 'word_search', onChange });

        // Open menu
        fireEvent.click(screen.getByRole('button'));

        // Select crossword
        fireEvent.click(screen.getByText('Crossword'));

        expect(onChange).toHaveBeenCalledWith('crossword');
    });

    test('does not call onChange when selecting same type', () => {
        const onChange = jest.fn();
        renderSelector({ currentType: 'word_search', onChange });

        // Open menu
        fireEvent.click(screen.getByRole('button'));

        // Select same type
        fireEvent.click(screen.getByText('Word Search'));

        expect(onChange).not.toHaveBeenCalled();
    });

    test('button is disabled when disabled prop is true', () => {
        renderSelector({ disabled: true });
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });

    test('closes menu after selection', () => {
        const onChange = jest.fn();
        renderSelector({ onChange });

        // Open menu
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('menu')).toBeInTheDocument();

        // Select crossword
        fireEvent.click(screen.getByText('Crossword'));

        // Menu should be closed (not in document or hidden)
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    test('has proper ARIA attributes', () => {
        renderSelector();
        const button = screen.getByRole('button');

        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).toHaveAttribute('id', 'game-type-button');

        // Open menu to check expanded
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });
});
