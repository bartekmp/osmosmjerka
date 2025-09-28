import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TableRowActions from '../TableRowActions';
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

describe('TableRowActions', () => {
    const testRow = { id: 1, name: 'Test Row' };
    
    test('renders edit and delete buttons', () => {
        renderWithTheme(
            <TableRowActions 
                row={testRow}
                onEdit={() => {}}
                onDelete={() => {}}
            />
        );
        
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
    
    test('calls onEdit with row when edit button is clicked', () => {
        const mockEdit = jest.fn();
        renderWithTheme(
            <TableRowActions 
                row={testRow}
                onEdit={mockEdit}
                onDelete={() => {}}
            />
        );
        
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(mockEdit).toHaveBeenCalledWith(testRow);
    });
    
    test('calls onDelete with row when delete button is clicked', () => {
        const mockDelete = jest.fn();
        renderWithTheme(
            <TableRowActions 
                row={testRow}
                onEdit={() => {}}
                onDelete={mockDelete}
            />
        );
        
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        expect(mockDelete).toHaveBeenCalledWith(testRow);
    });
});
