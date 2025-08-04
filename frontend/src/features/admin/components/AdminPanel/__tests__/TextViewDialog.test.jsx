import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TextViewDialog from '../TextViewDialog';
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

describe('TextViewDialog', () => {
    test('renders dialog when open is true', () => {
        renderWithTheme(
            <TextViewDialog 
                open={true}
                title="View Text"
                content="This is the content"
                onClose={() => {}}
            />
        );
        
        expect(screen.getByText('View Text')).toBeInTheDocument();
        expect(screen.getByText('This is the content')).toBeInTheDocument();
        expect(screen.getByText(/close/i)).toBeInTheDocument(); // button text from i18n
    });
    
    test('does not render when open is false', () => {
        renderWithTheme(
            <TextViewDialog 
                open={false}
                title="View Text"
                content="This is the content"
                onClose={() => {}}
            />
        );
        
        expect(screen.queryByText('View Text')).not.toBeInTheDocument();
        expect(screen.queryByText('This is the content')).not.toBeInTheDocument();
    });
    
    test('calls onClose when close button is clicked', () => {
        const mockClose = jest.fn();
        renderWithTheme(
            <TextViewDialog 
                open={true}
                title="View Text"
                content="This is the content"
                onClose={mockClose}
            />
        );
        
        fireEvent.click(screen.getByText(/close/i));
        expect(mockClose).toHaveBeenCalledTimes(1);
    });
    
    test('calls onClose when dialog backdrop is clicked', () => {
        const mockClose = jest.fn();
        renderWithTheme(
            <TextViewDialog 
                open={true}
                title="View Text"
                content="This is the content"
                onClose={mockClose}
            />
        );
        
        // Click on the backdrop (this may need adjustment depending on MUI's structure)
        const backdrop = document.querySelector('.MuiBackdrop-root');
        fireEvent.click(backdrop);
        
        expect(mockClose).toHaveBeenCalledTimes(1);
    });
    
    test('calls onClose when X button is clicked', () => {
        const mockClose = jest.fn();
        renderWithTheme(
            <TextViewDialog 
                open={true}
                title="View Text"
                content="This is the content"
                onClose={mockClose}
            />
        );
        
        // Find and click the X button (close icon)
        const closeButton = document.querySelector('[aria-label="close"]') || 
                            document.querySelector('button svg').closest('button');
        fireEvent.click(closeButton);
        
        expect(mockClose).toHaveBeenCalledTimes(1);
    });
});
