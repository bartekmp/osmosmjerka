import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import UploadForm from '../UploadForm';
import { withI18n } from '../../../../testUtils';

jest.mock('axios');

test('renders upload button', () => {
    render(withI18n(<UploadForm onUpload={() => { }} />));
    // The button text now includes emoji and may have responsive text
    const button = screen.getByRole('button', { name: /upload/i });
    expect(button).toBeInTheDocument();
});

test('shows error on upload failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { detail: 'Upload failed.' } } });
    const { container } = render(withI18n(<UploadForm onUpload={() => { }} />));
    // Try both possible button texts
    let btn = screen.queryByText(/Upload Words/i) || screen.getByRole('button', { name: /upload/i });
    fireEvent.click(btn);
    // Simulate file selection
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
        value: [new File(['test'], 'test.txt', { type: 'text/plain' })],
    });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/Upload failed/i)).toBeInTheDocument());
});