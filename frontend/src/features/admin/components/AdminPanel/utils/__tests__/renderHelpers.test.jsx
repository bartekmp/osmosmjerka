import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderExpandableText } from '../renderHelpers';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Create a test theme
const theme = createTheme({
    palette: {
        mode: 'light'
    }
});

// Wrap component with theme provider for testing
const renderWithTheme = (ui) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('renderHelpers', () => {
    describe('renderExpandableText', () => {
        const mockTranslationFn = (key) => key;
        const mockOpenTextDialog = jest.fn();
        
        test('returns original text when length is less than maxLength', () => {
            const shortText = 'Short text';
            const result = renderExpandableText(shortText, 'columnName', mockTranslationFn, mockOpenTextDialog, 50);
            expect(result).toBe(shortText);
        });
        
        test('returns clickable component when text exceeds maxLength', () => {
            const longText = 'This is a very long text that should be truncated and show an ellipsis';
            const result = renderExpandableText(longText, 'columnName', mockTranslationFn, mockOpenTextDialog, 20);
            
            renderWithTheme(result);
            
            // Check that truncated text is shown
            const displayedText = screen.getByText(/^This is a very long.../);
            expect(displayedText).toBeInTheDocument();
            
            // Verify truncation - only show first maxLength characters plus ellipsis
            expect(displayedText.textContent).toBe('This is a very long ...');
        });
        
        test('clicking truncated text calls openTextDialog with correct params', () => {
            const longText = 'This is a very long text that should be truncated and show an ellipsis';
            const result = renderExpandableText(longText, 'columnName', mockTranslationFn, mockOpenTextDialog, 20);
            
            renderWithTheme(result);
            
            // Click on the truncated text
            fireEvent.click(screen.getByText(/^This is a very long.../));
            
            // Verify dialog opens with correct parameters
            expect(mockOpenTextDialog).toHaveBeenCalledWith('columnName', longText);
        });
        
        test('handles undefined or empty text', () => {
            expect(renderExpandableText(undefined, 'columnName', mockTranslationFn, mockOpenTextDialog)).toBeUndefined();
            expect(renderExpandableText(null, 'columnName', mockTranslationFn, mockOpenTextDialog)).toBeNull();
            expect(renderExpandableText('', 'columnName', mockTranslationFn, mockOpenTextDialog)).toBe('');
        });
    });
});
