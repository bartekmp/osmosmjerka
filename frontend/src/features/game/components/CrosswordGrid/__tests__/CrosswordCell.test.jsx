import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import CrosswordCell from '../CrosswordCell';

// Create a basic theme for testing
const theme = createTheme();

const renderCell = (props = {}) => {
    const defaultProps = {
        row: 0,
        col: 0,
        userInput: '',
        isActive: false,
        isDisabled: false,
        isBlank: false,
        isCorrect: false,
        isWrong: false,
        isHighlighted: false,
        cursorDirection: null,
        cellSize: 40,
        onInput: jest.fn(),
        onFocus: jest.fn(),
        onKeyDown: jest.fn(),
        ...props,
    };

    return render(
        <ThemeProvider theme={theme}>
            <CrosswordCell {...defaultProps} />
        </ThemeProvider>
    );
};

describe('CrosswordCell', () => {
    test('renders regular cell with correct classes', () => {
        const { container } = renderCell({ isActive: true });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toBeInTheDocument();
        expect(cell).toHaveClass('active');
    });

    test('renders blank cell without input', () => {
        const { container } = renderCell({ isBlank: true });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toHaveClass('blank');
        expect(container.querySelector('input')).not.toBeInTheDocument();
    });

    test('renders disabled/correct cell', () => {
        const { container } = renderCell({ isDisabled: true, isCorrect: true });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toHaveClass('disabled');
        expect(cell).toHaveClass('correct');
    });

    test('renders wrong cell with shake animation', () => {
        const { container } = renderCell({ isWrong: true });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toHaveClass('wrong');
        expect(cell).toHaveClass('shake');
    });

    test('renders start number when provided', () => {
        renderCell({ startNumber: '5' });
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    test('calls onInput when typing a letter', () => {
        const onInput = jest.fn();
        const { container } = renderCell({ onInput });
        const input = container.querySelector('input');

        fireEvent.change(input, { target: { value: 'A' } });
        expect(onInput).toHaveBeenCalledWith(0, 0, 'A');
    });

    test('calls onFocus when clicking cell', () => {
        const onFocus = jest.fn();
        const { container } = renderCell({ onFocus, row: 2, col: 3 });
        const cell = container.querySelector('.crossword-cell');

        fireEvent.click(cell);
        expect(onFocus).toHaveBeenCalledWith(2, 3);
    });

    test('calls onKeyDown for arrow keys', () => {
        const onKeyDown = jest.fn();
        const { container } = renderCell({ onKeyDown, row: 1, col: 2 });
        const input = container.querySelector('input');

        fireEvent.keyDown(input, { key: 'ArrowRight' });
        expect(onKeyDown).toHaveBeenCalledWith(1, 2, 'ArrowRight');
    });

    test('calls onKeyDown and onInput for backspace', () => {
        const onKeyDown = jest.fn();
        const onInput = jest.fn();
        const { container } = renderCell({ onKeyDown, onInput, row: 1, col: 2 });
        const input = container.querySelector('input');

        fireEvent.keyDown(input, { key: 'Backspace' });
        expect(onInput).toHaveBeenCalledWith(1, 2, '');
        expect(onKeyDown).toHaveBeenCalledWith(1, 2, 'Backspace');
    });

    test('shows horizontal cursor for across direction', () => {
        const { container } = renderCell({ isActive: true, cursorDirection: 'across' });
        const cursor = container.querySelector('.cursor');
        expect(cursor).toBeInTheDocument();
        expect(cursor).toHaveClass('horizontal');
    });

    test('shows vertical cursor for down direction', () => {
        const { container } = renderCell({ isActive: true, cursorDirection: 'down' });
        const cursor = container.querySelector('.cursor');
        expect(cursor).toBeInTheDocument();
        expect(cursor).toHaveClass('vertical');
    });

    test('hides cursor when cell has input', () => {
        const { container } = renderCell({ isActive: true, userInput: 'A', cursorDirection: 'across' });
        const cursor = container.querySelector('.cursor');
        expect(cursor).not.toBeInTheDocument();
    });

    test('hides cursor when cell is disabled', () => {
        const { container } = renderCell({ isActive: true, isDisabled: true, cursorDirection: 'across' });
        const cursor = container.querySelector('.cursor');
        expect(cursor).not.toBeInTheDocument();
    });

    test('displays filled class when has user input', () => {
        const { container } = renderCell({ userInput: 'X' });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toHaveClass('filled');
    });

    test('displays highlighted class', () => {
        const { container } = renderCell({ isHighlighted: true });
        const cell = container.querySelector('.crossword-cell');
        expect(cell).toHaveClass('highlighted');
    });
});
