import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditWordDialog from '../EditWordDialog';
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

describe.skip('EditWordDialog component', () => {
    const testRow = { 
        id: 1, 
        categories: 'Animals',
        word: 'Dog',
        translation: 'Pies'
    };
    
    test('renders dialog with row data when open', () => {
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={() => {}}
                onSave={() => {}}
            />
        );
        
        expect(screen.getByText(/edit_word/i)).toBeInTheDocument();
        // Find inputs by their labels and check their values
        const categoryInput = screen.getByLabelText(/categories/i);
        const wordInput = screen.getByLabelText(/word/i); 
        const translationInput = screen.getByLabelText(/translation/i);
        
        expect(categoryInput).toHaveValue('Animals');
        expect(wordInput).toHaveValue('Dog');
        expect(translationInput).toHaveValue('Pies');
    });
    
    test('does not render when open is false', () => {
        renderWithTheme(
            <EditWordDialog 
                open={false}
                row={testRow}
                onClose={() => {}}
                onSave={() => {}}
            />
        );
        
        expect(screen.queryByText(/edit_word/i)).not.toBeInTheDocument();
    });
    
    test('calls onClose when cancel button is clicked', () => {
        const mockClose = jest.fn();
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={mockClose}
                onSave={() => {}}
            />
        );
        
        fireEvent.click(screen.getByText(/cancel/i));
        expect(mockClose).toHaveBeenCalledTimes(1);
    });
    
    test('save button is disabled when no changes are made', () => {
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={() => {}}
                onSave={() => {}}
            />
        );
        
        expect(screen.getByText(/save/i)).toBeDisabled();
    });
    
    test('save button is enabled when changes are made', () => {
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={() => {}}
                onSave={() => {}}
            />
        );
        
        // Make a change
        fireEvent.change(screen.getByLabelText(/word/i), { target: { value: 'Doggy' } });
        
        // Button should now be enabled
        expect(screen.getByText(/save/i)).not.toBeDisabled();
    });
    
    test('validates required fields on save', async () => {
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={() => {}}
                onSave={() => {}}
            />
        );
        
        // Clear a required field
        const wordInput = screen.getByLabelText(/word/i);
        fireEvent.change(wordInput, { target: { value: '' } });
        
        // Try to save
        fireEvent.click(screen.getByText(/save/i));
        
        // Should show validation error
        await waitFor(() => {
            expect(screen.getByText(/word_required/i)).toBeInTheDocument();
        });
    });
    
    test('calls onSave with updated data when valid', () => {
        const mockSave = jest.fn();
        renderWithTheme(
            <EditWordDialog 
                open={true}
                row={testRow}
                onClose={() => {}}
                onSave={mockSave}
            />
        );
        
        // Make a valid change
        const wordInput = screen.getByLabelText(/word/i);
        fireEvent.change(wordInput, { target: { value: 'Doggy' } });
        
        // Save the changes
        fireEvent.click(screen.getByText(/save/i));
        
        // Check if onSave was called with the correct data
        expect(mockSave).toHaveBeenCalledWith({
            ...testRow,
            word: 'Doggy'
        });
    });
});
