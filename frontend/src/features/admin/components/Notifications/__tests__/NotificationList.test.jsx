
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationList from '../NotificationList';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key, defaultValue) => defaultValue || key }),
}));

describe('NotificationList', () => {
    const mockNotifications = [
        {
            id: 1,
            title: 'Welcome',
            message: 'Welcome to the system',
            is_read: true,
            created_at: '2024-01-01T10:00:00',
            type: 'info'
        },
        {
            id: 2,
            title: 'Review Required',
            message: 'Please review translation',
            is_read: false,
            created_at: '2024-01-02T10:00:00',
            type: 'translation_review',
            link: '/review/123'
        }
    ];

    const mockHandlers = {
        onRead: jest.fn(),
        onDelete: jest.fn(),
        onReadAll: jest.fn(),
        onNavigate: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders loading state', () => {
        render(<NotificationList loading={true} notifications={[]} {...mockHandlers} />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('renders empty state', () => {
        render(<NotificationList loading={false} notifications={[]} {...mockHandlers} />);
        expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    test('renders list of notifications', () => {
        render(<NotificationList loading={false} notifications={mockNotifications} {...mockHandlers} />);

        expect(screen.getByText('Welcome')).toBeInTheDocument();
        expect(screen.getByText('Welcome to the system')).toBeInTheDocument();
        expect(screen.getByText('Review Required')).toBeInTheDocument();

        // Review chip check
        expect(screen.getByText('Review')).toBeInTheDocument();
    });

    test('calls onReadAll when "Mark all as read" clicked', () => {
        render(<NotificationList loading={false} notifications={mockNotifications} {...mockHandlers} />);

        fireEvent.click(screen.getByText('Mark all as read'));
        expect(mockHandlers.onReadAll).toHaveBeenCalled();
    });

    test('calls onRead and onNavigate when clicking unread item with link', () => {
        render(<NotificationList loading={false} notifications={mockNotifications} {...mockHandlers} />);

        // Click the second item (Review Required) which is unread and has link
        const reviewItem = screen.getByText('Review Required');
        fireEvent.click(reviewItem);

        expect(mockHandlers.onRead).toHaveBeenCalledWith(2);
        expect(mockHandlers.onNavigate).toHaveBeenCalledWith('/review/123');
    });

    test('does not call onRead when clicking read item', () => {
        render(<NotificationList loading={false} notifications={mockNotifications} {...mockHandlers} />);

        // Click first item (Welcome) which is read
        const welcomeItem = screen.getByText('Welcome');
        fireEvent.click(welcomeItem);

        expect(mockHandlers.onRead).not.toHaveBeenCalled();
    });

    test('calls onDelete when delete icon clicked', () => {
        render(<NotificationList loading={false} notifications={mockNotifications} {...mockHandlers} />);

        // Find delete buttons (IconButtons with DeleteIcon)
        // We can look by aria-label "delete" if it exists.
        // The code has aria-label="delete" on line 64.

        const deleteButtons = screen.getAllByLabelText('delete');
        fireEvent.click(deleteButtons[0]); // Delete first item

        expect(mockHandlers.onDelete).toHaveBeenCalledWith(1);
    });
});
