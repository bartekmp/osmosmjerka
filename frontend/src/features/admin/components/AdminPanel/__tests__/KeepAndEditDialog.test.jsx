import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import KeepAndEditDialog from '../KeepAndEditDialog';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

const theme = createTheme();
const renderDialog = (props = {}) =>
    render(
        <ThemeProvider theme={theme}>
            <KeepAndEditDialog
                open
                keepPhrase={{ id: 1, phrase: 'privit', translation: 'hi', categories: 'greetings' }}
                otherPhrases={[
                    { id: 2, phrase: 'privit', translation: 'hallo', categories: 'basics' },
                    { id: 3, phrase: 'privit', translation: 'hi', categories: 'x' },
                ]}
                onClose={() => {}}
                onSave={jest.fn()}
                {...props}
            />
        </ThemeProvider>
    );

describe('KeepAndEditDialog', () => {
    test('pre-fills the kept phrase fields', () => {
        renderDialog();
        expect(screen.getByLabelText('Phrase')).toHaveValue('privit');
        expect(screen.getByLabelText('Translation')).toHaveValue('hi');
        expect(screen.getByLabelText('Categories')).toHaveValue('greetings');
    });

    test('lists other duplicates that will be deleted', () => {
        renderDialog();
        expect(screen.getByText(/Other duplicates/i)).toBeInTheDocument();
        expect(screen.getByText(/hallo/)).toBeInTheDocument();
    });

    test('"append all" combines the other translations, skipping duplicates', () => {
        renderDialog();
        fireEvent.click(screen.getByText('Append all translations'));
        // starts "hi"; appends "hallo" (new) and "hi" (already present -> skipped)
        expect(screen.getByLabelText('Translation')).toHaveValue('hi; hallo');
    });

    test('save reports the edited fields', () => {
        const onSave = jest.fn();
        renderDialog({ onSave });
        fireEvent.change(screen.getByLabelText('Translation'), { target: { value: 'hi; hallo' } });
        fireEvent.click(screen.getByRole('button', { name: /Save & keep this/i }));
        expect(onSave).toHaveBeenCalledWith({ phrase: 'privit', translation: 'hi; hallo', categories: 'greetings' });
    });

    test('save is disabled without a phrase or translation', () => {
        renderDialog({ keepPhrase: { id: 1, phrase: '', translation: '', categories: '' }, otherPhrases: [] });
        expect(screen.getByRole('button', { name: /Save & keep this/i })).toBeDisabled();
    });
});
