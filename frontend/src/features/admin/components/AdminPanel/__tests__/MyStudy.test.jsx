import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyStudy from '../MyStudy';
import { withI18n } from '../../../../../testUtils';

jest.mock('../useStudentStudy', () => ({
    useStudentStudy: () => ({
        fetchMyGroups: jest.fn().mockResolvedValue([]),
        fetchInvitations: jest.fn().mockResolvedValue([]),
        fetchAssignedPuzzles: jest.fn().mockResolvedValue({ puzzles: [] }),
        acceptInvitation: jest.fn(),
        declineInvitation: jest.fn(),
        leaveGroup: jest.fn(),
    }),
}));

jest.mock('../../../../game/components/Review/ReviewSprintPanel', () => () => (
    <div data-testid="review-sprint-panel">Review sprint panel</div>
));

const renderMyStudy = () =>
    render(withI18n(
        <MemoryRouter>
            <MyStudy token="test-token" />
        </MemoryRouter>
    ));

test('renders three tabs including Review sprint', async () => {
    renderMyStudy();
    await waitFor(() => expect(screen.getByRole('tab', { name: /assigned puzzles/i })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /my study groups/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /review sprint/i })).toBeInTheDocument();
});

test('switching to the Review sprint tab embeds the panel in place, without navigating away', async () => {
    renderMyStudy();
    await waitFor(() => expect(screen.getByRole('tab', { name: /review sprint/i })).toBeInTheDocument());

    expect(screen.queryByTestId('review-sprint-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /review sprint/i }));
    expect(screen.getByTestId('review-sprint-panel')).toBeInTheDocument();
    // Still on the My Study page — the tab switch doesn't navigate to a new view.
    expect(screen.getByText('My Study')).toBeInTheDocument();
});
