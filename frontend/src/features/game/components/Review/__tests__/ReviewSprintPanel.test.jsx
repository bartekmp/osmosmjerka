import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewSprintPanel from '../ReviewSprintPanel';
import { withI18n } from '../../../../../testUtils';

jest.mock('../../../../../hooks/useSystemPreferences', () => ({
    useSystemPreferences: () => ({ ttsEnabled: false }),
}));

jest.mock('../VoiceManager', () => () => <div data-testid="voice-manager" />);

const mockUseReviewSprint = jest.fn();
jest.mock('../../../../../hooks/useReviewSprint', () => ({
    useReviewSprint: () => mockUseReviewSprint(),
}));

const renderPanel = (props) =>
    render(withI18n(
        <MemoryRouter>
            <ReviewSprintPanel {...props} />
        </MemoryRouter>
    ));

afterEach(() => {
    mockUseReviewSprint.mockReset();
});

test('shows a loading spinner', () => {
    mockUseReviewSprint.mockReturnValue({ status: 'loading' });
    renderPanel();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('empty state shows stats and an explainer when the user already has tracked words', () => {
    mockUseReviewSprint.mockReturnValue({
        status: 'empty',
        stats: { total: 5, due: 0, mastered: 1, streak: 2 },
        reviewedCount: 0,
        startSprint: jest.fn(),
    });
    renderPanel();
    expect(screen.getByText(/nothing due right now/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument();
    expect(screen.getByText(/tracked: 5/i)).toBeInTheDocument();
});

test('empty state omits the explainer when nothing has ever been tracked', () => {
    mockUseReviewSprint.mockReturnValue({
        status: 'empty',
        stats: { total: 0, due: 0, mastered: 0, streak: 0 },
        reviewedCount: 0,
        startSprint: jest.fn(),
    });
    renderPanel();
    expect(screen.queryByText(/nothing is lost/i)).not.toBeInTheDocument();
});

test('active state reveals the answer and submits a rating', () => {
    const rate = jest.fn();
    const reveal = jest.fn();
    mockUseReviewSprint.mockReturnValue({
        status: 'active',
        current: { phrase: 'kot', translation: 'cat', direction: 'recognition', target_lang: 'pl' },
        index: 0,
        total: 3,
        revealed: false,
        reveal,
        rate,
        stats: { total: 3, due: 3, mastered: 0, streak: 0 },
    });
    renderPanel();
    expect(screen.getByText('kot')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(reveal).toHaveBeenCalled();
});

test('active + revealed state shows the answer and rating buttons', () => {
    const rate = jest.fn();
    mockUseReviewSprint.mockReturnValue({
        status: 'active',
        current: { phrase: 'kot', translation: 'cat', direction: 'recognition', target_lang: 'pl' },
        index: 0,
        total: 3,
        revealed: true,
        reveal: jest.fn(),
        rate,
        stats: { total: 3, due: 3, mastered: 0, streak: 0 },
    });
    renderPanel();
    expect(screen.getByText('cat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /shaky/i }));
    expect(rate).toHaveBeenCalledWith('good');
});

test('done state offers to review more', () => {
    const startSprint = jest.fn();
    mockUseReviewSprint.mockReturnValue({
        status: 'done',
        stats: { total: 5, due: 0, mastered: 2, streak: 1 },
        reviewedCount: 5,
        startSprint,
    });
    renderPanel();
    expect(screen.getByText(/sprint complete/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /review more/i }));
    expect(startSprint).toHaveBeenCalled();
});

test('showBackToGame renders a back-to-game button', () => {
    mockUseReviewSprint.mockReturnValue({
        status: 'done',
        stats: { total: 1, due: 0, mastered: 0, streak: 0 },
        reviewedCount: 1,
        startSprint: jest.fn(),
    });
    renderPanel({ showBackToGame: true });
    expect(screen.getByRole('button', { name: /back to game/i })).toBeInTheDocument();
});

test('omits the back-to-game button by default (embedded usage)', () => {
    mockUseReviewSprint.mockReturnValue({
        status: 'done',
        stats: { total: 1, due: 0, mastered: 0, streak: 0 },
        reviewedCount: 1,
        startSprint: jest.fn(),
    });
    renderPanel();
    expect(screen.queryByRole('button', { name: /back to game/i })).not.toBeInTheDocument();
});
