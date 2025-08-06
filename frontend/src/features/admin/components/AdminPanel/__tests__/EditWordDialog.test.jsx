import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditWordDialog from '../EditWordDialog';
import { withI18n } from '../../../../../testUtils';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the categories API
jest.mock('../../../../../utils/categoriesApi', () => ({
    fetchCategories: jest.fn(() => Promise.resolve(['Animals', 'Colors', 'Food'])),
    invalidateCategoriesCache: jest.fn()
}));

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

describe('EditWordDialog component', () => {
    const testRow = {
        id: 1,
        categories: 'Animals',
        word: 'Dog',
        translation: 'Pies'
    };

    test('renders dialog with row data when open', async () => {
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={() => { }}
                onSave={() => { }}
            />
        );

        // Wait for the dialog to be rendered
        expect(await screen.findByText(/edit word/i)).toBeInTheDocument();

        // Wait for the form to be populated with data
        await waitFor(() => {
            expect(screen.getByDisplayValue('Dog')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Pies')).toBeInTheDocument();
        });

        // Check that categories are displayed as chips
        expect(screen.getByText('Animals')).toBeInTheDocument();
    });

    test('does not render when open is false', () => {
        renderWithTheme(
            <EditWordDialog
                open={false}
                row={testRow}
                onClose={() => { }}
                onSave={() => { }}
            />
        );

        expect(screen.queryByText(/edit word/i)).not.toBeInTheDocument();
    });

    test('calls onClose when cancel button is clicked', async () => {
        const mockClose = jest.fn();
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={mockClose}
                onSave={() => { }}
            />
        );

        // Wait for dialog to render and click cancel
        const cancelButton = await screen.findByText(/cancel/i);
        fireEvent.click(cancelButton);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    test('save button is disabled when no changes are made', async () => {
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={() => { }}
                onSave={() => { }}
            />
        );

        // Wait for dialog to render and check save button state
        const saveButton = await screen.findByText(/save/i);
        expect(saveButton).toBeDisabled();
    });

    test('save button is enabled when changes are made', async () => {
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={() => { }}
                onSave={() => { }}
            />
        );

        // Wait for form to be ready and make a change
        const wordInput = await screen.findByDisplayValue('Dog');
        fireEvent.change(wordInput, { target: { value: 'Doggy' } });

        // Wait for the save button to be enabled
        await waitFor(() => {
            const saveButton = screen.getByText(/save/i);
            expect(saveButton).not.toBeDisabled();
        });
    });

    test('validates required fields on save', async () => {
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={() => { }}
                onSave={() => { }}
            />
        );

        // Wait for form to be ready, clear a required field
        const wordInput = await screen.findByDisplayValue('Dog');
        fireEvent.change(wordInput, { target: { value: '' } });

        // Try to save
        const saveButton = await screen.findByText(/save/i);
        fireEvent.click(saveButton);

        // Should show validation error - look for any error text
        await waitFor(() => {
            // The component shows validation errors, let's look for error state
            expect(wordInput).toHaveAttribute('aria-invalid', 'true');
        }, { timeout: 3000 });
    });

    test('calls onSave with updated data when valid', async () => {
        const mockSave = jest.fn();
        renderWithTheme(
            <EditWordDialog
                open={true}
                row={testRow}
                onClose={() => { }}
                onSave={mockSave}
            />
        );

        // Wait for form to be ready and make a valid change
        const wordInput = await screen.findByDisplayValue('Dog');
        fireEvent.change(wordInput, { target: { value: 'Doggy' } });

        // Save the changes
        const saveButton = await screen.findByText(/save/i);
        await waitFor(() => expect(saveButton).not.toBeDisabled());
        fireEvent.click(saveButton);

        // Check if onSave was called with the correct data
        await waitFor(() => {
            expect(mockSave).toHaveBeenCalledWith({
                ...testRow,
                word: 'Doggy'
            });
        });
    });
});
