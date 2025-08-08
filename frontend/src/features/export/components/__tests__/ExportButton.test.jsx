import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ExportButton from '../ExportButton';
import { withI18n } from '../../../../testUtils';

jest.mock('axios');

// Silence jsdom navigation errors by mocking navigation-related APIs
let anchorClickSpy;
let createObjectURLSpy;
const originalLocation = window.location;

beforeAll(() => {
    // Mock anchor click and URL.createObjectURL used for blob downloads
    anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    if (URL && URL.createObjectURL) {
        createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    }
    // Mock window.location.assign if used
    delete window.location;
    window.location = { ...originalLocation, assign: jest.fn() };
});

afterAll(() => {
    anchorClickSpy && anchorClickSpy.mockRestore();
    createObjectURLSpy && createObjectURLSpy.mockRestore();
    window.location = originalLocation;
});

test('renders Export button', () => {
    render(withI18n(<ExportButton />));
    const button = screen.getByRole('button', { name: /export/i });
    expect(button).toBeInTheDocument();
});

test('opens modal when export button is clicked', () => {
    render(withI18n(<ExportButton category="TestCat" grid={[[1]]} phrases={['phrase']} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    // Check if modal is opened (match translation key or English fallback)
    expect(screen.getByText(/choose export format/i)).toBeInTheDocument();
    expect(screen.getByText(/word document/i)).toBeInTheDocument();
    expect(screen.getByText(/png image/i)).toBeInTheDocument();
});

test('handles export with format selection', async () => {
    const mockBlob = new Blob(['test data']);
    axios.post.mockResolvedValue({ data: mockBlob });
    render(withI18n(<ExportButton category="TestCat" grid={[['A']]} phrases={[{ phrase: 'test' }]} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    // Select DOCX format
    const docxButton = screen.getByText(/word document/i);
    fireEvent.click(docxButton);
    await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
            "/api/export",
            { category: "TestCat", grid: [['A']], phrases: [{ phrase: 'test' }], format: 'docx' },
            { responseType: 'blob' }
        );
    });
});

test('handles export failure', async () => {
    const error = new Error('Export failed');
    axios.post.mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    render(withI18n(<ExportButton category="TestCat" grid={[[1]]} phrases={['phrase']} />));
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    const docxButton = screen.getByText(/word document/i);
    fireEvent.click(docxButton);
    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Export failed', error);
    });
    consoleErrorSpy.mockRestore();
});