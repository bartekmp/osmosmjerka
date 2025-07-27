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

test('opens modal when export button is clicked', () => {
    render(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />);
    const btn = screen.getByRole('button', { name: /export/i });

    fireEvent.click(btn);

    // Check if modal is opened
    expect(screen.getByText('Choose Export Format')).toBeInTheDocument();
    expect(screen.getByText('Word Document')).toBeInTheDocument();
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByText('PNG Image')).toBeInTheDocument();
});

test('handles export with format selection', async () => {
    const mockBlob = new Blob(['test data']);
    axios.post.mockResolvedValue({ data: mockBlob });

    render(<ExportButton category="TestCat" grid={[['A']]} words={[{ word: 'test' }]} />);
    const btn = screen.getByRole('button', { name: /export/i });

    // Open modal
    fireEvent.click(btn);

    // Select PDF format
    const pdfButton = screen.getByText('PDF Document');
    fireEvent.click(pdfButton);

    await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
            "/api/export",
            { category: "TestCat", grid: [['A']], words: [{ word: 'test' }], format: 'pdf' },
            { responseType: 'blob' }
        );
    });
});

test('handles export failure', async () => {
    const error = new Error('Export failed');
    axios.post.mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />);
    const btn = screen.getByRole('button', { name: /export/i });

    // Open modal and select format
    fireEvent.click(btn);
    const docxButton = screen.getByText('Word Document');
    fireEvent.click(docxButton);

    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Export failed:', error);
    });

    consoleErrorSpy.mockRestore();
});