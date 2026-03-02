import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TableNoRowsOverlay from '../TableNoRowsOverlay';
import { withI18n } from '../../../../../testUtils';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Create a test theme
const theme = createTheme({
    palette: {
        mode: 'light'
    }
});

// Mock translations
const mockTranslationFn = (key) => {
    const translations = {
        'no_rows_found': 'No rows found',
        'try_different_search_terms': 'Try different search terms',
        'category_empty': 'Category is empty',
        'no_phrases_in_selected_category': 'No phrases in selected category',
        'clear_search': 'Clear Search'
    };
    return translations[key] || key;
};

// Wrap component with theme provider for testing
const renderWithTheme = (ui) => {
    return render(withI18n(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    ));
};

describe('TableNoRowsOverlay', () => {
    test('renders nothing when isEmpty is false', () => {
        const { container } = renderWithTheme(
            <TableNoRowsOverlay 
                isEmpty={false}
                searchTerm=""
                onClearSearch={() => {}}
                translationFn={mockTranslationFn}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    test('renders empty category message when table is empty with no search', () => {
        renderWithTheme(
            <TableNoRowsOverlay 
                isEmpty={true}
                searchTerm=""
                onClearSearch={() => {}}
                translationFn={mockTranslationFn}
            />
        );
        
        expect(screen.getByText('Category is empty')).toBeInTheDocument();
        expect(screen.getByText('No phrases in selected category')).toBeInTheDocument();
        // Should not render clear search button
        expect(screen.queryByText('Clear Search')).not.toBeInTheDocument();
    });

    test('renders no results message when search has no results', () => {
        renderWithTheme(
            <TableNoRowsOverlay 
                isEmpty={true}
                searchTerm="test"
                onClearSearch={() => {}}
                translationFn={mockTranslationFn}
            />
        );
        
        expect(screen.getByText('No rows found')).toBeInTheDocument();
        expect(screen.getByText('Try different search terms')).toBeInTheDocument();
        expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });

    test('calls onClearSearch when clear button is clicked', () => {
        const mockClearSearch = jest.fn();
        renderWithTheme(
            <TableNoRowsOverlay 
                isEmpty={true}
                searchTerm="test"
                onClearSearch={mockClearSearch}
                translationFn={mockTranslationFn}
            />
        );
        
        fireEvent.click(screen.getByText('Clear Search'));
        expect(mockClearSearch).toHaveBeenCalledTimes(1);
    });
});
