import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatisticsDialog from '../StatisticsDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, defaultValue) => defaultValue || key,
    }),
}));

describe('StatisticsDialog Component', () => {
    const defaultProps = {
        open: false,
        onClose: jest.fn(),
        onRefresh: jest.fn(),
        loading: false,
        listStats: null,
        userStats: null,
    };

    const sampleListStats = {
        list_name: 'My Custom List',
        total_phrases: 150,
        custom_phrases: 50,
        public_phrases: 100,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-02-10T15:30:00Z',
    };

    const sampleUserStats = {
        total_lists: 5,
        total_phrases: 500,
        most_used_lists: [
            { id: 1, list_name: 'Common Phrases', phrase_count: 200 },
            { id: 2, list_name: 'Technical Terms', phrase_count: 150 },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('does not render when open is false', () => {
            render(<StatisticsDialog {...defaultProps} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true', () => {
            render(<StatisticsDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('shows loading indicator when no list stats', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={null} />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders refresh and close buttons', () => {
            render(<StatisticsDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
        });
    });

    describe('List Statistics Display', () => {
        it('displays list name', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} />);
            expect(screen.getByText('My Custom List')).toBeInTheDocument();
        });

        it('displays total phrases count', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} />);
            expect(screen.getByText('150')).toBeInTheDocument();
        });

        it('displays custom and public phrases', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} />);
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('100')).toBeInTheDocument();
        });

        it('displays formatted dates', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} />);
            expect(screen.getByText(/Created/i)).toBeInTheDocument();
            expect(screen.getByText(/Last Updated/i)).toBeInTheDocument();
        });

        it('displays dash when dates are missing', () => {
            const statsWithoutDates = { ...sampleListStats, created_at: null, updated_at: null };
            render(<StatisticsDialog {...defaultProps} open={true} listStats={statsWithoutDates} />);

            const dashes = screen.getAllByText('-');
            expect(dashes.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('User Statistics Display', () => {
        it('does not show user stats section when null', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} userStats={null} />);
            expect(screen.queryByText(/Your Overall Statistics/i)).not.toBeInTheDocument();
        });

        it('displays user overall statistics', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} userStats={sampleUserStats} />);

            expect(screen.getByText(/Your Overall Statistics/i)).toBeInTheDocument();
            expect(screen.getAllByText('5')[0]).toBeInTheDocument(); // total_lists
            expect(screen.getAllByText('500')[0]).toBeInTheDocument(); // total_phrases
        });

        it('displays most used lists', () => {
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} userStats={sampleUserStats} />);

            expect(screen.getByText('Common Phrases')).toBeInTheDocument();
            expect(screen.getByText('Technical Terms')).toBeInTheDocument();
            expect(screen.getByText('200 phrases')).toBeInTheDocument();
            expect(screen.getByText('150 phrases')).toBeInTheDocument();
        });

        it('does not show most used lists section when empty', () => {
            const statsWithoutMostUsed = { ...sampleUserStats, most_used_lists: [] };
            render(<StatisticsDialog {...defaultProps} open={true} listStats={sampleListStats} userStats={statsWithoutMostUsed} />);

            expect(screen.queryByText(/Most Used Lists/i)).not.toBeInTheDocument();
        });
    });

    describe('Refresh Functionality', () => {
        it('calls onRefresh when refresh button clicked', () => {
            const onRefresh = jest.fn();
            render(<StatisticsDialog {...defaultProps} open={true} onRefresh={onRefresh} />);

            const refreshButton = screen.getByRole('button', { name: /Refresh/i });
            fireEvent.click(refreshButton);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('disables refresh button when loading', () => {
            render(<StatisticsDialog {...defaultProps} open={true} loading={true} />);

            const refreshButton = screen.getByRole('button', { name: /Refresh/i });
            expect(refreshButton).toBeDisabled();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button clicked', () => {
            const onClose = jest.fn();
            render(<StatisticsDialog {...defaultProps} open={true} onClose={onClose} />);

            const closeButton = screen.getByRole('button', { name: /Close/i });
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
