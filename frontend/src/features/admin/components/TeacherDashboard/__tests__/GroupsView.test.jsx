
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupsView from '../GroupsView';
import { useGroups } from '../useGroups';

// Mock useGroups
jest.mock('../useGroups');

// Mock Translation
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, optionsOrDefault) => {
            if (typeof optionsOrDefault === 'string') return optionsOrDefault;
            if (optionsOrDefault && optionsOrDefault.defaultValue) {
                return optionsOrDefault.defaultValue
                    .replace('{{count}}', optionsOrDefault.count)
                    .replace('{{name}}', optionsOrDefault.name);
            }
            return key;
        },
    }),
}));

describe('GroupsView', () => {
    const mockFetchGroups = jest.fn();
    const mockCreateGroup = jest.fn();
    const mockDeleteGroup = jest.fn();
    const mockFetchGroupMembers = jest.fn();
    const mockAddMember = jest.fn();
    const mockRemoveMember = jest.fn();

    beforeEach(() => {
        useGroups.mockReturnValue({
            isLoading: false,
            fetchGroups: mockFetchGroups,
            createGroup: mockCreateGroup,
            deleteGroup: mockDeleteGroup,
            fetchGroupMembers: mockFetchGroupMembers,
            addMember: mockAddMember,
            removeMember: mockRemoveMember,
        });
        mockFetchGroups.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders groups list', async () => {
        const groups = [
            { id: 1, name: 'Group A', member_count: 5 },
            { id: 2, name: 'Group B', member_count: 0 },
        ];
        mockFetchGroups.mockResolvedValue(groups);

        render(<GroupsView token="test-token" />);

        await waitFor(() => {
            expect(screen.getByText('Group A')).toBeInTheDocument();
            expect(screen.getByText('Group B')).toBeInTheDocument();
        });
        expect(screen.getByText('5 students')).toBeInTheDocument();
        expect(screen.getByText('0 students')).toBeInTheDocument();
    });

    test('opens create group dialog and creates group', async () => {
        render(<GroupsView token="test-token" />);

        fireEvent.click(screen.getByText('Create Group'));

        const input = screen.getByLabelText('Group Name');
        fireEvent.change(input, { target: { value: 'New Group' } });

        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(mockCreateGroup).toHaveBeenCalledWith('New Group');
        });
        expect(mockFetchGroups).toHaveBeenCalledTimes(2); // Initial load + refresh
    });

    test('deletes group after confirmation', async () => {
        const groups = [{ id: 1, name: 'Group A', member_count: 0 }];
        mockFetchGroups.mockResolvedValue(groups);
        window.confirm = jest.fn(() => true);

        render(<GroupsView token="test-token" />);

        await waitFor(() => {
            expect(screen.getByText('Group A')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Delete'));

        await waitFor(() => {
            expect(mockDeleteGroup).toHaveBeenCalledWith(1);
        });
        expect(mockFetchGroups).toHaveBeenCalledTimes(2);
    });

    test('opens manage members dialog', async () => {
        const groups = [{ id: 1, name: 'Group A', member_count: 0 }];
        mockFetchGroups.mockResolvedValue(groups);
        mockFetchGroupMembers.mockResolvedValue([
            { id: 101, username: 'student1', added_at: '2025-01-01' }
        ]);

        render(<GroupsView token="test-token" />);

        await waitFor(() => expect(screen.getByText('Group A')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Manage Members'));

        await waitFor(() => {
            expect(screen.getByText('Manage Group A')).toBeInTheDocument();
            expect(screen.getByText('student1')).toBeInTheDocument();
        });
    });
});
