import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserManagement from '../UserManagement';

// Mock fetch
global.fetch = jest.fn();

const mockUsers = [
    {
        id: 0,
        username: 'root',
        role: 'root_admin',
        self_description: 'Root Administrator',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-12-01T00:00:00Z'
    },
    {
        id: 1,
        username: 'admin',
        role: 'administrative',
        self_description: 'Admin User',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-12-01T00:00:00Z'
    },
    {
        id: 2,
        username: 'user',
        role: 'regular',
        self_description: 'Regular User',
        created_at: '2023-01-01T00:00:00Z',
        last_login: null
    }
];

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('UserManagement', () => {
    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    users: mockUsers
                })
            })
        );
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn().mockReturnValue('mock-admin-token'),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            writable: true
        });
    });

    test('should disable role dropdown when editing root admin user', async () => {
        // Use root admin as current user to be able to edit other root admin
        render(<UserManagement currentUser={mockUsers[0]} />);

        // Wait for component to load users
        await waitFor(() => {
            expect(screen.getByText('root')).toBeInTheDocument();
        });

        // Find and click edit button for root user (first row)
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        fireEvent.click(editButtons[0]);

        // Wait for dialog to open and check that role select is disabled
        await waitFor(() => {
            expect(screen.getByText('edit_user')).toBeInTheDocument();
        });

        // Look for the role select by looking for the input element with disabled attribute
        const roleInput = screen.getByDisplayValue('root_admin');
        expect(roleInput).toBeDisabled();
    });

    test('should enable role dropdown when editing non-root admin user', async () => {
        render(<UserManagement currentUser={mockUsers[1]} />);

        // Wait for component to load users
        await waitFor(() => {
            expect(screen.getByText('admin')).toBeInTheDocument();
        });

        // Find and click edit button for admin user (second row)
        const editButtons = screen.getAllByRole('button', { name: /edit/i });
        fireEvent.click(editButtons[1]);

        // Wait for dialog to open and check that role select is enabled
        await waitFor(() => {
            expect(screen.getByText('edit_user')).toBeInTheDocument();
        });

        const roleInput = screen.getByDisplayValue('administrative');
        expect(roleInput).not.toBeDisabled();
    });

    test('should enable role dropdown when creating new user', async () => {
        render(<UserManagement currentUser={mockUsers[1]} />);

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText('root')).toBeInTheDocument();
        });

        // Click create user button
        const createButton = screen.getByRole('button', { name: /create_user/i });
        fireEvent.click(createButton);

        // Wait for dialog to open
        await waitFor(() => {
            expect(screen.getByText('create_new_user')).toBeInTheDocument();
        });

        // Check that role select is enabled (should have default value 'regular')
        const roleInput = screen.getByDisplayValue('regular');
        expect(roleInput).not.toBeDisabled();
    });
});
