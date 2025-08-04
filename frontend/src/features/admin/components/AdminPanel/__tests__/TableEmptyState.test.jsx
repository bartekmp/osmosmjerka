import React from 'react';
import { render, screen } from '@testing-library/react';
import TableEmptyState from '../TableEmptyState';
import { withI18n } from '../../../../../testUtils';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Create a test theme
const theme = createTheme({
    palette: {
        mode: 'light'
    }
});

// Wrap component with theme provider for testing
const renderWithTheme = (ui) => {
    return render(withI18n(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    ));
};

describe('TableEmptyState', () => {
    test('renders message correctly', () => {
        renderWithTheme(<TableEmptyState message="No data available" />);
        expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    test('renders title when provided', () => {
        renderWithTheme(<TableEmptyState title="Empty Table" message="No data available" />);
        expect(screen.getByText('Empty Table')).toBeInTheDocument();
        expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    test('renders icon when provided', () => {
        const TestIcon = () => <div data-testid="test-icon">Icon</div>;
        renderWithTheme(
            <TableEmptyState 
                message="No data available" 
                icon={<TestIcon />} 
            />
        );
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
        expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    test('applies custom styles when provided', () => {
        const { container } = renderWithTheme(
            <TableEmptyState 
                message="No data available" 
                sx={{ backgroundColor: 'rgb(255, 0, 0)' }}
            />
        );
        
        const emptyStateBox = container.firstChild;
        const styles = window.getComputedStyle(emptyStateBox);
        expect(styles.backgroundColor).toBe('rgb(255, 0, 0)');
    });
});
