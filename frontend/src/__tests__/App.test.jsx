import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

jest.mock('axios');

afterEach(() => {
    jest.clearAllMocks();
});

test('renders admin link', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/ignored_categories')) {
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

    render(<BrowserRouter><App /></BrowserRouter>);
    expect(await screen.findByText(/Admin/i)).toBeInTheDocument();
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

    render(<BrowserRouter><App /></BrowserRouter>);
    expect(await screen.findByText(/Not enough words in the selected category/i)).toBeInTheDocument();
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

    render(<BrowserRouter><App /></BrowserRouter>);
    expect(await screen.findByRole('combobox', { name: /category/i })).toBeInTheDocument();
});

test('renders reload button', async () => {
    axios.get.mockImplementation((url) => {
        if (url.startsWith('/api/ignored_categories')) {
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

    render(<BrowserRouter><App /></BrowserRouter>);
    await waitFor(() => {
        expect(screen.getByTitle(/Reload puzzle/i)).toBeInTheDocument();
    });
});