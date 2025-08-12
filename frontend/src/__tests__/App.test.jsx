import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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
        if (typeof url === 'string' && url.startsWith('/api/default-ignored-categories')) {
            return Promise.resolve({ data: [] });
        }
        if (typeof url === 'string' && url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (typeof url === 'string' && url.startsWith('/api/phrases')) {
            return Promise.resolve({ data: { grid: [], phrases: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    expect(await screen.findByText(/Profile/i)).toBeInTheDocument();
});

test('shows not enough phrases overlay', async () => {
    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('/api/default-ignored-categories')) {
            return Promise.resolve({ data: [] });
        }
        if (typeof url === 'string' && url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['TestCategory'] });
        }
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [] });
        }
        if (typeof url === 'string' && url.startsWith('/api/phrases')) {
            return Promise.reject({ 
                response: { 
                    status: 404, 
                    data: { 
                        error: 'NOT_ENOUGH_PHRASES',
                        category: 'TestCategory',
                        available: 0,
                        needed: 5
                    } 
                } 
            });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    
    // Wait for the app to load and show the category selector
    const combos = await screen.findAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);

    // Find and click the refresh button to trigger puzzle loading
    const refreshButton = await screen.findByTitle(/reload puzzle/i);
    
    // Use act to ensure all state updates are processed
    await act(async () => {
        fireEvent.click(refreshButton);
    });

    // Wait for the error state to be set by checking for content that appears when there are not enough phrases
    await waitFor(() => {
        const errorElement = screen.getByText(/not enough phrases/i);
        expect(errorElement).toBeInTheDocument();
    }, { timeout: 10000 });
});

test('renders category selector', async () => {
    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (typeof url === 'string' && url.startsWith('/api/phrases')) {
            return Promise.resolve({ data: { grid: [], phrases: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    const combos = await screen.findAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
});

test('renders reload button', async () => {
    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('/api/default-ignored-categories')) {
            return Promise.resolve({ data: [] });
        }
        if (typeof url === 'string' && url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['A', 'B'] });
        }
        if (typeof url === 'string' && url.startsWith('/api/phrases')) {
            return Promise.resolve({ data: { grid: [], phrases: [] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));
    await waitFor(() => {
        expect(screen.getByTitle(/reload/i)).toBeInTheDocument();
    });
});