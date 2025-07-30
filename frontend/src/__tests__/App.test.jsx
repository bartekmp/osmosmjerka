import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { withI18n } from '../testUtils';

jest.mock('axios');

afterEach(() => {
    jest.clearAllMocks();
});

test('renders profile link', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/ignored-categories')) {
            return Promise.resolve({ data: [] });
        }
        if (url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (url.startsWith('/api/words')) {
            return Promise.resolve({ data: { grid: [], words: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    expect(await screen.findByText(/Profile/i)).toBeInTheDocument();
});

test('shows not enough words overlay', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/words')) {
            return Promise.resolve({
                data: {
                    error_code: "NOT_ENOUGH_WORDS",
                    detail: "Not enough words in the selected category.",
                    grid: [],
                    words: []
                }
            });
        }
        if (url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    // Accept either translation or fallback detail
    const overlays = await screen.findAllByText((content) =>
        /not enough words/i.test(content)
    );
    expect(overlays.length).toBeGreaterThan(0);
});

test('renders category selector', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (url.startsWith('/api/words')) {
            return Promise.resolve({ data: { grid: [], words: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    const combos = await screen.findAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
});

test('renders reload button', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/ignored-categories')) {
            return Promise.resolve({ data: [] });
        }
        if (url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (url.startsWith('/api/words')) {
            return Promise.resolve({ data: { grid: [], words: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    await waitFor(() => {
        expect(screen.getByTitle(/reload/i)).toBeInTheDocument();
    });
});