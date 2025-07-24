import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ExportButton from '../ExportButton';

jest.mock('axios');

test('renders Export button', () => {
    render(<ExportButton foundWords={[]} difficulty={'beginner'} />);
    // The button text now includes emoji and may have responsive text
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeInTheDocument();
});

test('handles export failure', async () => {
    const error = new Error('Export failed');
    axios.post.mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />);
    // Updated selector to match the new button label
    const btn = screen.getByRole('button', { name: /export/i });

    fireEvent.click(btn);

    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    consoleErrorSpy.mockRestore();
});