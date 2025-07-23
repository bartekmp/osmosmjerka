import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import Grid from '../Grid';

// Create a basic theme for testing
const theme = createTheme();

test('renders empty message if grid is empty', () => {
    render(
        <ThemeProvider theme={theme}>
            <Grid grid={[]} words={[]} found={[]} onFound={() => { }} />
        </ThemeProvider>
    );
    expect(screen.getByText(/No puzzle available/i)).toBeInTheDocument();
});

test('renders grid cells', () => {
    const grid = [['A', 'B'], ['C', 'D']];
    render(
        <ThemeProvider theme={theme}>
            <Grid grid={grid} words={[]} found={[]} onFound={() => { }} />
        </ThemeProvider>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
});

test('highlights found word cells', () => {
    const grid = [['A', 'B'], ['C', 'D']];
    const words = [
        { word: 'AB', coords: [[0,0],[0,1]] },
        { word: 'CD', coords: [[1,0],[1,1]] }
    ];
    const found = ['AB'];
    // Render the grid with the found word
    render(
        <ThemeProvider theme={theme}>
            <Grid grid={grid} words={words} found={found} onFound={() => { }} />
        </ThemeProvider>
    );
    // Check that cells (0,0) and (0,1) have the highlight class
    expect(screen.getByText('A').className).toMatch(/found/);
    expect(screen.getByText('B').className).toMatch(/found/);
    // And that 'C' and 'D' are not highlighted
    expect(screen.getByText('C').className).not.toMatch(/found/);
    expect(screen.getByText('D').className).not.toMatch(/found/);
});