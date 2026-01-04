
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewTranslationsDialog from '../ReviewTranslationsDialog';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (typeof options === 'string') return options;
            let val = options?.defaultValue || key;
            if (options && typeof options === 'object') {
                Object.keys(options).forEach(k => {
                    if (k !== 'defaultValue') {
                        val = val.replace(`{{${k}}}`, options[k]);
                    }
                });
            }
            return val;
        }
    }),
}));

// Mock clipboard
Object.assign(navigator, {
    clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    },
});

describe('ReviewTranslationsDialog', () => {
    const mockSession = {
        id: 1,
        nickname: 'Student1',
        translation_submissions: [
            {
                phrase: 'Hello',
                correct: 'Bok',
                submitted: 'Bok',
                is_correct: true
            },
            {
                phrase: 'Goodbye',
                correct: 'Doviđenja',
                submitted: 'Zdravo',
                is_correct: false
            }
        ]
    };

    const mockOnClose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders nothing when closed', () => {
        render(
            <ReviewTranslationsDialog
                open={false}
                onClose={mockOnClose}
                session={mockSession}
            />
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('renders dialog with session data', () => {
        render(
            <ReviewTranslationsDialog
                open={true}
                onClose={mockOnClose}
                session={mockSession}
            />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Review Translations')).toBeInTheDocument();
        expect(screen.getByText(/Student1/)).toBeInTheDocument();

        // Check submissions
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getAllByText('Bok').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Goodbye')).toBeInTheDocument();
        expect(screen.getByText('Doviđenja')).toBeInTheDocument();
        expect(screen.getByText('Zdravo')).toBeInTheDocument();
    });

    test('shows correct/incorrect chips', () => {
        render(
            <ReviewTranslationsDialog
                open={true}
                onClose={mockOnClose}
                session={mockSession}
            />
        );

        expect(screen.getAllByText('Correct')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Incorrect')[0]).toBeInTheDocument();
    });

    test('shows empty state when no submissions', () => {
        render(
            <ReviewTranslationsDialog
                open={true}
                onClose={mockOnClose}
                session={{ ...mockSession, translation_submissions: [] }}
            />
        );

        expect(screen.getByText('No translation submissions found for this session.')).toBeInTheDocument();
    });

    test('copies to clipboard', async () => {
        render(
            <ReviewTranslationsDialog
                open={true}
                onClose={mockOnClose}
                session={mockSession}
            />
        );

        const copyButton = screen.getByText('Copy Results');
        fireEvent.click(copyButton);

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
        });

        // Verify clipboard content
        const expectedContent = expect.stringContaining('Translation Review - Student1');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedContent);

        // Wait for snackbar
        expect(await screen.findByText('Results copied to clipboard')).toBeInTheDocument();
    });

    test('calls onClose when close button clicked', () => {
        render(
            <ReviewTranslationsDialog
                open={true}
                onClose={mockOnClose}
                session={mockSession}
            />
        );

        const closeButton = screen.getByText('Close');
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });
});
