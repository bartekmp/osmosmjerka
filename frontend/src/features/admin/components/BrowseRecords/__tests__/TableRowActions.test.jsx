import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TableRowActions from '../TableRowActions';
import { withI18n } from '../../../../../testUtils';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { installedVoiceForLang, speak, warmup } from '../../../../../hooks/localTts';

// The play action reads installed voices + speaks/warms through localTts.
jest.mock('../../../../../hooks/localTts', () => ({
    installedVoiceForLang: jest.fn(() => 'pl_PL-gosia-medium'),
    speak: jest.fn(),
    warmup: jest.fn(),
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

    describe('TTS play button', () => {
        const phraseRow = { id: 2, phrase: 'kot', translation: 'cat' };
        beforeEach(() => {
            installedVoiceForLang.mockReturnValue('pl_PL-gosia-medium');
            speak.mockClear();
        });

        test('not shown by default (ttsEnabled false)', () => {
            renderWithTheme(<TableRowActions row={phraseRow} onEdit={() => {}} onDelete={() => {}} />);
            expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument();
        });

        test('shown and speaks the phrase when enabled with an installed voice', () => {
            renderWithTheme(
                <TableRowActions row={phraseRow} onEdit={() => {}} onDelete={() => {}} ttsEnabled targetLang="pl" />
            );
            const play = screen.getByRole('button', { name: /listen/i });
            fireEvent.click(play);
            expect(speak).toHaveBeenCalledWith('kot', 'pl_PL-gosia-medium');
        });

        test('warms up the engine on hover', () => {
            warmup.mockClear();
            renderWithTheme(
                <TableRowActions row={phraseRow} onEdit={() => {}} onDelete={() => {}} ttsEnabled targetLang="pl" />
            );
            fireEvent.pointerEnter(screen.getByRole('button', { name: /listen/i }));
            expect(warmup).toHaveBeenCalledWith('pl_PL-gosia-medium');
        });

        test('hidden when no voice for the language is installed', () => {
            installedVoiceForLang.mockReturnValue(null);
            renderWithTheme(
                <TableRowActions row={phraseRow} onEdit={() => {}} onDelete={() => {}} ttsEnabled targetLang="pl" />
            );
            expect(screen.queryByRole('button', { name: /listen/i })).not.toBeInTheDocument();
        });
    });
});
