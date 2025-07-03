import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ExportButton from '../ExportButton';

jest.mock('axios');

test('renders export button and triggers export', async () => {
    axios.post.mockResolvedValue({ data: new Blob(['test']) });
    const createObjectURL = jest.fn(() => 'blob:url');
    global.URL.createObjectURL = createObjectURL;
    const remove = jest.fn();
    const mockedLinkClick = jest.fn();

    render(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />);
    const btn = screen.getByText(/Export to DOCX/i);

    const realCreateElement = document.createElement;
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
            const a = realCreateElement.call(document, tagName);
            a.click = mockedLinkClick;
            a.setAttribute = jest.fn();
            a.remove = remove;
            return a;
        }
        return realCreateElement.call(document, tagName);
    });

    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });

    fireEvent.click(btn);

    await waitFor(() => {
        expect(mockedLinkClick).toHaveBeenCalled();
    });

    expect(btn).toBeInTheDocument();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
});

test('handles export failure', async () => {
    const error = new Error('Export failed');
    axios.post.mockRejectedValue(error);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<ExportButton category="TestCat" grid={[[1]]} words={['word']} />);
    const btn = screen.getByText(/Export to DOCX/i);

    fireEvent.click(btn);

    await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });

    consoleErrorSpy.mockRestore();
});