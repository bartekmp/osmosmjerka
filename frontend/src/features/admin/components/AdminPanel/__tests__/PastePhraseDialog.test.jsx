import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PastePhraseDialog from '../PastePhraseDialog';
import { withI18n } from '../../../../../testUtils';

// Create a light theme for MUI components used within the dialog
const theme = createTheme({
    palette: { mode: 'light' }
});

const renderWithProviders = (ui) => {
    return render(withI18n(
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    ));
};

describe('PastePhraseDialog', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('auto-detect finds semicolon and enables upload', async () => {
        renderWithProviders(
            <PastePhraseDialog open={true} onClose={() => {}} onUpload={() => {}} selectedLanguageSetId={1} />
        );

        // Paste content with semicolon separators
        const textarea = await screen.findByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'categories;phrase;translation\nA;hello;hi\nB;bye;cześć' } });

        // Preview should render and no error should be shown
        expect(await screen.findByText(/preview/i)).toBeInTheDocument();

        // Upload button should be enabled (no preview error and non-empty input)
        const uploadBtn = screen.getByRole('button', { name: /upload pasted/i });
        expect(uploadBtn).not.toBeDisabled();
    });

    test('disables upload when specific separator does not match input', async () => {
        renderWithProviders(
            <PastePhraseDialog open={true} onClose={() => {}} onUpload={() => {}} selectedLanguageSetId={1} />
        );

        // Enter semicolon-separated content
        const textarea = await screen.findByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'categories;phrase;translation\nA;hello;hi' } });

        // Change separator to comma
        const separatorLabel = screen.getByLabelText(/separator/i);
        fireEvent.mouseDown(separatorLabel);
        const listbox = await screen.findByRole('listbox');
        fireEvent.click(within(listbox).getByText(','));

        // The dialog disables upload when the selected separator doesn't match input
        const uploadBtn = screen.getByRole('button', { name: /upload pasted/i });
        await waitFor(() => expect(uploadBtn).toBeDisabled());
        // And no preview is shown in this case (since parsing failed)
        expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    });

    test('auto-detect failure disables upload (no preview)', async () => {
        renderWithProviders(
            <PastePhraseDialog open={true} onClose={() => {}} onUpload={() => {}} selectedLanguageSetId={1} />
        );

        const textarea = await screen.findByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'onlyone\nanotherone' } });

        // Auto-detect failure should disable upload
        const uploadBtn = screen.getByRole('button', { name: /upload pasted/i });
        await waitFor(() => expect(uploadBtn).toBeDisabled());
        // And preview should not be shown
        expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    });

    test('instructions display <TAB> when tab separator is selected', async () => {
        renderWithProviders(
            <PastePhraseDialog open={true} onClose={() => {}} onUpload={() => {}} selectedLanguageSetId={1} />
        );

        // Select Tab as separator
        const separatorLabel = screen.getByLabelText(/separator/i);
        fireEvent.mouseDown(separatorLabel);
        const listbox = await screen.findByRole('listbox');
        fireEvent.click(within(listbox).getByText(/tab/i));

        // The instruction line should show the visible token <TAB>
        expect(
            await screen.findByText(/categories<TAB>phrase<TAB>translation/i)
        ).toBeInTheDocument();
    });
});
