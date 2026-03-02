import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShareListDialog from '../ShareListDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, defaultValue) => defaultValue || key,
    }),
}));

describe('ShareListDialog Component', () => {
    const defaultProps = {
        open: false,
        onClose: jest.fn(),
        onShare: jest.fn(),
        onUnshare: jest.fn(),
        loading: false,
        listShares: [],
    };

    const existingShares = [
        { id: 1, username: 'user1', permission: 'read', shared_with_user_id: 101 },
        { id: 2, username: 'user2', permission: 'write', shared_with_user_id: 102 },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('does not render when open is false', () => {
            render(<ShareListDialog {...defaultProps} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('renders username input field', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);
            expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
        });

        it('renders permission chips', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);
            expect(screen.getByText(/Read Only/i)).toBeInTheDocument();
            expect(screen.getByText(/Read & Write/i)).toBeInTheDocument();
        });
    });

    describe('Permission Selection', () => {
        it('selects read permission by default', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            const readChip = screen.getByText(/Read Only/i).closest('.MuiChip-root');
            expect(readChip).toHaveClass('MuiChip-colorPrimary');
        });

        it('switches to write permission when clicked', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            const writeChip = screen.getByText(/Read & Write/i);
            fireEvent.click(writeChip);

            const writeChipElement = writeChip.closest('.MuiChip-root');
            expect(writeChipElement).toHaveClass('MuiChip-colorPrimary');
        });

        it('switches back to read permission', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            // Click write, then read
            fireEvent.click(screen.getByText(/Read & Write/i));
            fireEvent.click(screen.getByText(/Read Only/i));

            const readChip = screen.getByText(/Read Only/i).closest('.MuiChip-root');
            expect(readChip).toHaveClass('MuiChip-colorPrimary');
        });
    });

    describe('Share Functionality', () => {
        it('disables share button when username is empty', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            const shareButton = screen.getByRole('button', { name: /Share/i });
            expect(shareButton).toBeDisabled();
        });

        it('enables share button when username is entered', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            const usernameInput = screen.getByLabelText(/Username/i);
            fireEvent.change(usernameInput, { target: { value: 'newuser' } });

            const shareButton = screen.getByRole('button', { name: /Share/i });
            expect(shareButton).not.toBeDisabled();
        });

        it('calls onShare with username and permission', () => {
            const onShare = jest.fn();
            render(<ShareListDialog {...defaultProps} open={true} onShare={onShare} />);

            const usernameInput = screen.getByLabelText(/Username/i);
            fireEvent.change(usernameInput, { target: { value: 'newuser' } });

            const shareButton = screen.getByRole('button', { name: /Share/i });
            fireEvent.click(shareButton);

            expect(onShare).toHaveBeenCalledWith('newuser', 'read');
        });

        it('resets username after sharing', () => {
            render(<ShareListDialog {...defaultProps} open={true} />);

            const usernameInput = screen.getByLabelText(/Username/i);
            fireEvent.change(usernameInput, { target: { value: 'newuser' } });

            const shareButton = screen.getByRole('button', { name: /Share/i });
            fireEvent.click(shareButton);

            expect(usernameInput).toHaveValue('');
        });
    });

    describe('Existing Shares Display', () => {
        it('shows message when not shared with anyone', () => {
            render(<ShareListDialog {...defaultProps} open={true} listShares={[]} />);
            expect(screen.getByText(/Not shared with anyone/i)).toBeInTheDocument();
        });

        it('displays table of existing shares', () => {
            render(<ShareListDialog {...defaultProps} open={true} listShares={existingShares} />);

            expect(screen.getByText('user1')).toBeInTheDocument();
            expect(screen.getByText('user2')).toBeInTheDocument();
        });

        it('displays permission badges for shares', () => {
            render(<ShareListDialog {...defaultProps} open={true} listShares={existingShares} />);

            const permissionChips = screen.getAllByText(/read|write/i);
            expect(permissionChips.length).toBeGreaterThan(0);
        });

        it('renders unshare buttons for each share', () => {
            render(<ShareListDialog {...defaultProps} open={true} listShares={existingShares} />);

            const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
                btn => btn.querySelector('svg[data-testid="DeleteIcon"]')
            );
            expect(deleteButtons.length).toBe(2);
        });
    });

    describe('Unshare Functionality', () => {
        it('calls onUnshare with user id when delete clicked', () => {
            const onUnshare = jest.fn();
            render(<ShareListDialog {...defaultProps} open={true} listShares={existingShares} onUnshare={onUnshare} />);

            const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
                btn => btn.querySelector('svg[data-testid="DeleteIcon"]')
            );

            fireEvent.click(deleteButtons[0]);

            expect(onUnshare).toHaveBeenCalledWith(101);
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button clicked', () => {
            const onClose = jest.fn();
            render(<ShareListDialog {...defaultProps} open={true} onClose={onClose} />);

            const closeButton = screen.getByRole('button', { name: /Close/i });
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('resets fields on close', () => {
            const { rerender } = render(<ShareListDialog {...defaultProps} open={true} />);

            const usernameInput = screen.getByLabelText(/Username/i);
            fireEvent.change(usernameInput, { target: { value: 'testuser' } });

            const closeButton = screen.getByRole('button', { name: /Close/i });
            fireEvent.click(closeButton);

            rerender(<ShareListDialog {...defaultProps} open={false} />);
            rerender(<ShareListDialog {...defaultProps} open={true} />);

            expect(usernameInput).toHaveValue('');
        });
    });

    describe('Loading State', () => {
        it('disables username input when loading', () => {
            render(<ShareListDialog {...defaultProps} open={true} loading={true} />);

            const usernameInput = screen.getByLabelText(/Username/i);
            expect(usernameInput).toBeDisabled();
        });

        it('disables share button when loading', () => {
            render(<ShareListDialog {...defaultProps} open={true} loading={true} />);

            const shareButton = screen.getByRole('button', { name: /Share/i });
            expect(shareButton).toBeDisabled();
        });

        it('disables unshare buttons when loading', () => {
            render(<ShareListDialog {...defaultProps} open={true} listShares={existingShares} loading={true} />);

            const deleteButtons = screen.getAllByRole('button', { name: '' }).filter(
                btn => btn.querySelector('svg[data-testid="DeleteIcon"]')
            );

            deleteButtons.forEach(button => {
                expect(button).toBeDisabled();
            });
        });
    });
});
