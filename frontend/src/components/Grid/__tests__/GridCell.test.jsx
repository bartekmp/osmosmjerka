import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import GridCell from '../GridCell';

// Create a basic theme for testing
const theme = createTheme();

test('renders cell with correct value and classes', () => {
    render(
        <ThemeProvider theme={theme}>
            <GridCell r={0} c={1} cell="X" isSelected={true} isFound={false} handleMouseDown={() => { }} handleMouseEnter={() => { }} cellSize={40} />
        </ThemeProvider>
    );
    const box = screen.getByText('X');
    expect(box).toHaveClass('grid-cell');
    expect(box).toHaveClass('selected');
    expect(box).not.toHaveClass('found');
});

test('calls handlers on mouse events', () => {
    const onDown = jest.fn();
    const onEnter = jest.fn();
    render(
        <ThemeProvider theme={theme}>
            <GridCell r={2} c={3} cell="Y" isSelected={false} isFound={true} handleMouseDown={onDown} handleMouseEnter={onEnter} cellSize={40} />
        </ThemeProvider>
    );
    const box = screen.getByText('Y');
    fireEvent.mouseDown(box);
    fireEvent.mouseEnter(box);
    expect(onDown).toHaveBeenCalledWith(2, 3);
    expect(onEnter).toHaveBeenCalledWith(2, 3);
});