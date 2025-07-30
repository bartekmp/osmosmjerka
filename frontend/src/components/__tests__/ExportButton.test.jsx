import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ExportButton from '../ExportButton';
import { withI18n } from '../../testUtils';

jest.mock('axios');

test('renders Export button', () => {
    render(withI18n(<ExportButton foundWords={[]} difficulty={'beginner'} />));
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeInTheDocument();
});

test('opens modal when export button is clicked', () => {
    render(withI18n(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    // Check if modal is opened (match translation key or English fallback)
    expect(screen.getByText(/choose export format/i)).toBeInTheDocument();
    expect(screen.getByText(/word document/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf document/i)).toBeInTheDocument();
    expect(screen.getByText(/png image/i)).toBeInTheDocument();
});

test('handles export with format selection', async () => {
    const mockBlob = new Blob(['test data']);
    axios.post.mockResolvedValue({ data: mockBlob });
    render(withI18n(<ExportButton category="TestCat" grid={[['A']]} words={[{ word: 'test' }]} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    // Select PDF format
    const pdfButton = screen.getByText(/pdf document/i);
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
    render(withI18n(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    const docxButton = screen.getByText(/word document/i);
    fireEvent.click(docxButton);
    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Export failed', error);
    });
    consoleErrorSpy.mockRestore();
});