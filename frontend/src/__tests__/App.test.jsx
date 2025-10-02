import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import axios from 'axios';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { withI18n } from '../testUtils';

jest.mock('axios');

jest.mock('../features/game/components/Timer', () => {
    const React = require('react');
    return {
        Timer: ({ currentElapsedTime = 0, resetTrigger = 0, onTimeUpdate }) => {
            React.useEffect(() => {
                if (onTimeUpdate) {
                    onTimeUpdate(currentElapsedTime);
                }
            }, [currentElapsedTime, onTimeUpdate]);

            return React.createElement(
                'div',
                { 'data-testid': 'mock-timer' },
                `Timer:${currentElapsedTime}|Reset:${resetTrigger}`
            );
        }
    };
});

jest.mock('../features/game/components/ScoreDisplay', () => {
    const React = require('react');
    return {
        ScoreDisplay: ({ currentScore = 0 }) => React.createElement(
            'div',
            { 'data-testid': 'mock-score' },
            `Score:${currentScore}`
        )
    };
});

const originalWarn = console.warn;

beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation((...args) => {
        if (typeof args[0] === 'string' && args[0].includes('MUI: You have provided an out-of-range value')) {
            return;
        }
        originalWarn(...args);
    });
});

afterAll(() => {
    console.warn.mockRestore();
});

afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
});

beforeEach(() => {
    axios.post.mockImplementation((url, body) => {
        if (typeof url === 'string' && url.includes('/system/calculate-score')) {
            const phrasesFound = body?.phrases_found ?? 0;
            const hintsUsed = body?.hints_used ?? 0;
            const baseScore = phrasesFound * 100;
            const hintPenalty = hintsUsed * 75;
            const finalScore = Math.max(0, baseScore - hintPenalty);

            return Promise.resolve({
                data: {
                    base_score: baseScore,
                    difficulty_bonus: 0,
                    time_bonus: 0,
                    streak_bonus: 0,
                    hint_penalty: hintPenalty,
                    final_score: finalScore,
                    hints_used: hintsUsed,
                    hint_penalty_per_hint: 75,
                },
            });
        }

        return Promise.resolve({ data: {} });
    });
});

test('renders profile link', async () => {
    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [{ id: 1, display_name: 'Default', description: '' }] });
        }
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
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [{ id: 1, display_name: 'Default', description: '' }] });
        }
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
    await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
    });

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
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [{ id: 1, display_name: 'Default', description: '' }] });
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
    const combos = await screen.findAllByRole('combobox');
    expect(combos.length).toBeGreaterThan(0);
});

test('renders reload button', async () => {
    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [{ id: 1, display_name: 'Default', description: '' }] });
        }
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

test('resets timer and score when refreshing the puzzle', async () => {
    localStorage.setItem('osmosmjerkaGameState', JSON.stringify({
        grid: [['A']],
        phrases: ['ONE', 'TWO'],
        found: ['ONE'],
        selectedCategory: 'TestCategory',
        difficulty: 'easy',
        hidePhrases: false,
        showTranslations: false,
        elapsedTimeSeconds: 5
    }));

    axios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/system/scoring-enabled')) {
            return Promise.resolve({ data: { enabled: true } });
        }
        if (typeof url === 'string' && url.includes('/system/progressive-hints-enabled')) {
            return Promise.resolve({ data: { enabled: false } });
        }
        if (typeof url === 'string' && url.includes('/system/scoring-rules')) {
            return Promise.resolve({
                data: {
                    base_points_per_phrase: 100,
                    completion_bonus_points: 200,
                    difficulty_multipliers: {
                        very_easy: 0.9,
                        easy: 1.0,
                        medium: 1.2,
                        hard: 1.5,
                        very_hard: 2.0,
                    },
                    hint_penalty_per_hint: 75,
                    time_bonus: {
                        max_ratio: 0.3,
                        target_times_seconds: {
                            very_easy: 240,
                            easy: 300,
                            medium: 600,
                            hard: 900,
                            very_hard: 1200,
                        },
                    },
                },
            });
        }
        if (typeof url === 'string' && url.startsWith('/api/language-sets')) {
            return Promise.resolve({ data: [{ id: 1, display_name: 'Default', description: '' }] });
        }
        if (typeof url === 'string' && url.startsWith('/api/categories')) {
            return Promise.resolve({ data: ['TestCategory'] });
        }
        if (typeof url === 'string' && url.startsWith('/api/phrases')) {
            return Promise.resolve({ data: { grid: [['B']], phrases: ['TWO'] } });
        }
        return Promise.resolve({ data: [] });
    });

    render(withI18n(<BrowserRouter><App /></BrowserRouter>));

    const timer = await screen.findByTestId('mock-timer');
    const score = await screen.findByTestId('mock-score');

    await waitFor(() => {
        expect(timer).toHaveTextContent('Timer:5');
        expect(score).toHaveTextContent('Score:100');
    });

    const refreshButton = await screen.findByTitle(/reload puzzle/i);
    await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
    });
    await act(async () => {
        fireEvent.click(refreshButton);
    });

    await waitFor(() => {
        expect(screen.getByTestId('mock-timer')).toHaveTextContent('Timer:0');
        expect(screen.getByTestId('mock-timer')).toHaveTextContent('Reset:1');
        expect(screen.getByTestId('mock-score')).toHaveTextContent('Score:0');
    });
});