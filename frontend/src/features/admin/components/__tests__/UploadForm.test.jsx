import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiClient from '@shared/utils/apiClient';
import UploadForm from '../UploadForm';
import { withI18n } from '../../../../testUtils';

jest.mock('@shared/utils/apiClient');

const CSV = 'categories;phrase;translation\nHrana;voda;woda\nHrana;kruh;chleb\nPriroda;more;morze';

function selectFile(container, content = CSV, name = 'phrases.csv') {
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
        value: [new File([content], name, { type: 'text/csv' })],
        configurable: true,
    });
    fireEvent.change(input);
}

beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    // A language set must be selected before the component will upload anything.
    localStorage.setItem('selectedLanguageSet', '1');
});

test('renders upload button', () => {
    render(withI18n(<UploadForm onUpload={() => { }} />));
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
});

test('shows a progress dialog with row counts and refreshes the table when closed', async () => {
    apiClient.post.mockResolvedValue({ data: { message: 'Uploaded 3 phrases' } });
    const onUpload = jest.fn();

    const { container } = render(withI18n(<UploadForm onUpload={onUpload} />));
    selectFile(container);

    await waitFor(() => expect(screen.getByText(/Imported 3 phrases/i)).toBeInTheDocument());
    expect(screen.getByText('3 of 3 phrases')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    // The dialog, not a snackbar, is what reports the result - and closing it is what
    // triggers the refetch, so the result cannot be missed.
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
});

test('blocks dismissal while the upload is still running', async () => {
    let releaseUpload;
    apiClient.post.mockReturnValue(new Promise((resolve) => { releaseUpload = resolve; }));

    const { container } = render(withI18n(<UploadForm onUpload={() => { }} />));
    selectFile(container);

    await waitFor(() => expect(screen.getByText(/Keep this window open/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();

    releaseUpload({ data: {} });
    await waitFor(() => expect(screen.getByRole('button', { name: /close/i })).toBeEnabled());
});

test('reports a failed chunk with how many phrases landed first', async () => {
    const longCsv = 'categories;phrase;translation\n' +
        Array.from({ length: 600 }, (_, i) => `cat;phrase${i};translation${i}`).join('\n');
    apiClient.post
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce({ response: { data: { error: 'Line 7: Expected 3 columns' } } });
    const onUpload = jest.fn();

    const { container } = render(withI18n(<UploadForm onUpload={onUpload} />));
    selectFile(container, longCsv);

    await waitFor(() => expect(screen.getByText(/Line 7: Expected 3 columns/)).toBeInTheDocument());
    expect(screen.getByText(/Imported 500 of 600 phrases/i)).toBeInTheDocument();
    expect(screen.getByText(/at or after line 502/i)).toBeInTheDocument();

    // A partial import still changed the table, so closing must refresh it.
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
});

test('rejects a file with no recognisable separator without calling the API', async () => {
    const { container } = render(withI18n(<UploadForm onUpload={() => { }} />));
    selectFile(container, 'this is not a csv file', 'notes.txt');

    await waitFor(() => expect(screen.getByText(/could not detect a separator/i)).toBeInTheDocument());
    expect(apiClient.post).not.toHaveBeenCalled();
});

test('refuses a file above the size limit', async () => {
    const { container } = render(withI18n(<UploadForm onUpload={() => { }} />));
    const input = container.querySelector('input[type="file"]');
    const big = new File(['x'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { value: [big], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(screen.getByText(/File is too large/i)).toBeInTheDocument());
    expect(apiClient.post).not.toHaveBeenCalled();
});
