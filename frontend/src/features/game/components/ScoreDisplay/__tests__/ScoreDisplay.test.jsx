import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScoreDisplay from '../ScoreDisplay';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, params) => {
            // Simple translation mock
            const translations = {
                'current_score': 'Current Score',
                'base_score': 'Base Score',
                'difficulty_bonus': 'Difficulty Bonus',
                'time_bonus': 'Time Bonus',
                'completion_bonus': 'Completion Bonus',
                'hint_penalty': 'Hint Penalty',
                'score_breakdown': 'Score Breakdown',
                'hints': 'hints',
                'close': 'Close',
                'try_again': 'Try Again',
                'scoring_rules.title': 'Scoring Rules',
                'scoring_rules.cta': 'Click to view scoring details',
                'scoring_rules.open_button_aria': 'Open scoring details dialog',
                'scoring_rules.loading': 'Loading scoring rules...',
                'scoring_rules.error': 'Failed to load scoring rules',
                'scoring_rules.intro': 'How scoring works:',
                'scoring_rules.base': `Base: {{points}} points per phrase`,
                'scoring_rules.difficulty': 'Difficulty Multipliers:',
                'scoring_rules.difficulty_item': `{{difficultyLabel}}: {{multiplier}}x`,
                'scoring_rules.completion': `Completion: {{points}} bonus points`,
                'scoring_rules.hint': `Hints: -{{points}} per hint`,
                'scoring_rules.time_bonus': `Time Bonus: up to {{percent}}%`,
                'scoring_rules.time_bonus_item': `{{difficultyLabel}}: target {{time}}`,
                'score_details.overview_title': 'Score Overview',
                'score_details.final_score_label': 'Final Score',
                'score_details.duration_label': 'Duration',
                'score_details.difficulty_label': 'Difficulty',
                'score_details.hints_used': `{{count}} hints used`,
                'score_details.no_hints_used': 'No hints used',
                'score_details.bonuses_penalties_title': 'Bonuses & Penalties',
                'score_details.total_points': 'Total',
                'score_details.per_phrase_title': 'Per Phrase',
                'score_details.phrase_points': `{{phrase}}: {{points}} pts`,
                'score_details.no_breakdown': 'No score breakdown available',
                'score_details.rules_heading': 'Scoring Rules',
                'hints_penalty': `{{count}} hints used`,
                'very_easy': 'Very Easy',
                'easy': 'Easy',
                'medium': 'Medium',
                'hard': 'Hard',
                'very_hard': 'Very Hard',
            };

            let result = translations[key] || key;
            if (params) {
                Object.keys(params).forEach(param => {
                    result = result.replace(`{{${param}}}`, params[param]);
                });
            }
            return result;
        },
    }),
}));

describe('ScoreDisplay Component', () => {
    const defaultProps = {
        currentScore: 100,
        showScore: true,
    };

    describe('Basic Rendering', () => {
        it('renders score correctly', () => {
            render(<ScoreDisplay {...defaultProps} />);
            expect(screen.getByText(/100/)).toBeInTheDocument();
        });

        it('does not render when showScore is false', () => {
            const { container } = render(<ScoreDisplay {...defaultProps} showScore={false} />);
            expect(container.firstChild).toBeNull();
        });

        it('renders in compact mode', () => {
            const { container } = render(<ScoreDisplay {...defaultProps} compact={true} />);
            expect(container.querySelector('.score-display-compact')).toBeInTheDocument();
        });

        it('formats large scores with locale string', () => {
            render(<ScoreDisplay {...defaultProps} currentScore={123456} />);
            expect(screen.getByText(/123,456/)).toBeInTheDocument();
        });
    });

    describe('Hints Display', () => {
        it('shows hints chip when hints are used', () => {
            render(<ScoreDisplay {...defaultProps} hintsUsed={3} />);
            expect(screen.getByText(/3 hints/)).toBeInTheDocument();
        });

        it('does not show hints chip when no hints used', () => {
            render(<ScoreDisplay {...defaultProps} hintsUsed={0} />);
            expect(screen.queryByText(/hints/)).not.toBeInTheDocument();
        });
    });

    describe('Score Breakdown', () => {
        const breakdownProps = {
            ...defaultProps,
            scoreBreakdown: {
                base_score: 50,
                difficulty_bonus: 20,
                time_bonus: 15,
                streak_bonus: 10, // Component uses streak_bonus, not completion_bonus
                hint_penalty: 5,
                final_score: 90,
                difficulty: 'medium',
                duration_seconds: 125,
                hints_used: 1,
            },
        };

        it('displays score breakdown when provided', () => {
            render(<ScoreDisplay {...breakdownProps} />);
            expect(screen.getByText('Score Breakdown:')).toBeInTheDocument();
            expect(screen.getByText('+50')).toBeInTheDocument();
        });

        it('shows difficulty bonus when present', () => {
            render(<ScoreDisplay {...breakdownProps} />);
            expect(screen.getByText('+20')).toBeInTheDocument();
        });

        it('shows time bonus when present', () => {
            render(<ScoreDisplay {...breakdownProps} />);
            expect(screen.getAllByText('+15').length).toBeGreaterThan(0);
        });

        it('shows completion bonus when present', () => {
            render(<ScoreDisplay {...breakdownProps} />);
            expect(screen.getByText('+10')).toBeInTheDocument();
        });

        it('shows hint penalty when present', () => {
            render(<ScoreDisplay {...breakdownProps} />);
            expect(screen.getByText('-5')).toBeInTheDocument();
        });

        it('displays per-phrase breakdown when provided', () => {
            const propsWithPerPhrase = {
                ...breakdownProps,
                scoreBreakdown: {
                    ...breakdownProps.scoreBreakdown,
                    per_phrase: [
                        { id: 1, phrase: 'test1', points: 10 },
                        { id: 2, phrase: 'test2', points: 15 },
                    ],
                },
            };

            render(<ScoreDisplay {...propsWithPerPhrase} />);
            expect(screen.getByText(/test1: 10 pts/)).toBeInTheDocument();
            expect(screen.getByText(/test2: 15 pts/)).toBeInTheDocument();
        });
    });

    describe('Dialog Interactions', () => {
        it('opens dialog when score is clicked', async () => {
            render(<ScoreDisplay {...defaultProps} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            // Dialog title appears - might have multiple "Scoring Rules" (title + heading)
            await waitFor(() => {
                expect(screen.getAllByText('Scoring Rules').length).toBeGreaterThan(0);
            });
        });

        it('opens dialog on Enter key press', async () => {
            render(<ScoreDisplay {...defaultProps} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.keyDown(scoreElement, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getAllByText('Scoring Rules').length).toBeGreaterThan(0);
            });
        });

        it('opens dialog on Space key press', async () => {
            render(<ScoreDisplay {...defaultProps} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.keyDown(scoreElement, { key: ' ' });

            await waitFor(() => {
                expect(screen.getAllByText('Scoring Rules').length).toBeGreaterThan(0);
            });
        });

        it('closes dialog when close button is clicked', async () => {
            render(<ScoreDisplay {...defaultProps} />);

            // Open dialog
            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getAllByText('Scoring Rules').length).toBeGreaterThan(0);
            });

            // Close dialog
            const closeButtons = screen.getAllByRole('button', { name: /Close/i });
            const dialogCloseButton = closeButtons.find(button =>
                button.textContent === 'Close' && button.closest('[role="dialog"]')
            ) || closeButtons[0];
            fireEvent.click(dialogCloseButton);

            await waitFor(() => {
                expect(screen.queryByText('Score Overview')).not.toBeInTheDocument();
            });
        });
    });

    describe('Scoring Rules', () => {
        const scoringRules = {
            base_points_per_phrase: 10,
            difficulty_multipliers: {
                easy: 1.0,
                medium: 1.5,
                hard: 2.0,
            },
            difficulty_order: ['easy', 'medium', 'hard'],
            completion_bonus_points: 50,
            hint_penalty_per_hint: 5,
            time_bonus: {
                max_ratio: 0.5,
                target_times_seconds: {
                    easy: 60,
                    medium: 120,
                    hard: 180,
                },
            },
        };

        it('displays scoring rules when provided', async () => {
            render(<ScoreDisplay {...defaultProps} scoringRules={scoringRules} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getByText(/Base: 10 points per phrase/i)).toBeInTheDocument();
                expect(screen.getByText(/Completion: 50 bonus points/i)).toBeInTheDocument();
                expect(screen.getByText(/Hints: -5 per hint/i)).toBeInTheDocument();
            });
        });

        it('shows loading state when rules are loading', async () => {
            render(<ScoreDisplay {...defaultProps} scoringRulesStatus="loading" />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getByText('Loading scoring rules...')).toBeInTheDocument();
            });
        });

        it('shows error state when rules fail to load', async () => {
            render(<ScoreDisplay {...defaultProps} scoringRulesStatus="error" />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getByText('Failed to load scoring rules')).toBeInTheDocument();
            });
        });

        it('calls onReloadScoringRules when try again is clicked', async () => {
            const mockReload = jest.fn();
            render(<ScoreDisplay {...defaultProps} scoringRulesStatus="error" onReloadScoringRules={mockReload} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getByText('Try Again')).toBeInTheDocument();
            });

            const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
            fireEvent.click(tryAgainButton);

            expect(mockReload).toHaveBeenCalled();
        });

        it('loads rules on dialog open if not already loaded', async () => {
            const mockReload = jest.fn();
            render(<ScoreDisplay {...defaultProps} onReloadScoringRules={mockReload} scoringRules={null} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(mockReload).toHaveBeenCalled();
            });
        });
    });

    describe('Dialog Opener Registration', () => {
        it('registers dialog opener on mount', () => {
            const mockRegister = jest.fn();
            render(<ScoreDisplay {...defaultProps} registerDialogOpener={mockRegister} />);

            expect(mockRegister).toHaveBeenCalled();
            expect(mockRegister.mock.calls[0][0]).toBeInstanceOf(Function);
        });

        it('unregisters dialog opener on unmount', () => {
            const mockRegister = jest.fn();
            const { unmount } = render(<ScoreDisplay {...defaultProps} registerDialogOpener={mockRegister} />);

            unmount();

            expect(mockRegister).toHaveBeenCalledWith(null);
        });

        it('does not register when showScore is false', () => {
            const mockRegister = jest.fn();
            render(<ScoreDisplay {...defaultProps} showScore={false} registerDialogOpener={mockRegister} />);

            expect(mockRegister).not.toHaveBeenCalled();
        });
    });

    describe('Compact Mode', () => {
        it('renders compact mode with tooltip', () => {
            render(<ScoreDisplay {...defaultProps} compact={true} />);

            const compactElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            expect(compactElement).toBeInTheDocument();
            expect(compactElement.closest('.score-display-compact')).toBeInTheDocument();
        });

        it('opens dialog from compact mode', async () => {
            render(<ScoreDisplay {...defaultProps} compact={true} />);

            const scoreElement = screen.getByRole('button', { name: /Open scoring details dialog/i });
            fireEvent.click(scoreElement);

            await waitFor(() => {
                expect(screen.getAllByText('Scoring Rules').length).toBeGreaterThan(0);
            });
        });
    });
});
