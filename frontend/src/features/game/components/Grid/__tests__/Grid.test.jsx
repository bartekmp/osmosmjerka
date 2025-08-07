import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import Grid from '../Grid';
import { withI18n } from '../../../../../testUtils';

// Create a basic theme for testing
const theme = createTheme();

test('renders empty message if grid is empty', () => {
    render(
        withI18n(
            <ThemeProvider theme={theme}>
                <Grid grid={[]} phrases={[]} found={[]} onFound={() => { }} />
            </ThemeProvider>
        )
    );
    expect(screen.getByText(/no puzzle available/i)).toBeInTheDocument();
});

test('renders grid cells', () => {
    const grid = [['A', 'B'], ['C', 'D']];
    render(
        withI18n(
            <ThemeProvider theme={theme}>
                <Grid grid={grid} phrases={[]} found={[]} onFound={() => { }} />
            </ThemeProvider>
        )
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
});

test('highlights found phrase cells', () => {
    const grid = [['A', 'B'], ['C', 'D']];
    const phrases = [
        { phrase: 'AB', coords: [[0, 0], [0, 1]] },
        { phrase: 'CD', coords: [[1, 0], [1, 1]] }
    ];
    const found = ['AB'];
    // Render the grid with the found phrase
    render(
        withI18n(
            <ThemeProvider theme={theme}>
                <Grid grid={grid} phrases={phrases} found={found} onFound={() => { }} />
            </ThemeProvider>
        )
    );
    // Check that cells (0,0) and (0,1) have the highlight class
    expect(screen.getByText('A').className).toMatch(/found/);
    expect(screen.getByText('B').className).toMatch(/found/);
    // And that 'C' and 'D' are not highlighted
    expect(screen.getByText('C').className).not.toMatch(/found/);
    expect(screen.getByText('D').className).not.toMatch(/found/);
});