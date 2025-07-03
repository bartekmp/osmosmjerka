import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import UploadForm from '../UploadForm';

jest.mock('axios');

test('renders upload button', () => {
    render(<UploadForm onUpload={() => { }} />);
    expect(screen.getByText(/Upload Words/i)).toBeInTheDocument();
});

test('shows error on upload failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { detail: 'Upload failed.' } } });
    const { container } = render(<UploadForm onUpload={() => { }} />);
    const btn = screen.getByText(/Upload Words/i);
    fireEvent.click(btn);
    // Simulate file selection
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
        value: [new File(['test'], 'test.txt', { type: 'text/plain' })],
    });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/Upload failed/i)).toBeInTheDocument());
});