import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteConfirmationDialog from '../DeleteConfirmationDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, params) => {
            if (params?.name) return `${key} ${params.name}`;
            return key;
        },
    }),
}));

describe('DeleteConfirmationDialog Component', () => {
    const defaultProps = {
        open: false,
        list: null,
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        loading: false,
    };

    const normalList = {
        list_name: 'My Custom List',
        is_system_list: false,
    };

    const systemList = {
        list_name: 'System List',
        is_system_list: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('does not render when open is false', () => {
            render(<DeleteConfirmationDialog {...defaultProps} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('does not render when list is null', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={null} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true and list is provided', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('privateListManager.lists.confirmDelete')).toBeInTheDocument();
        });

        it('displays list name in warning message', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} />);

            expect(screen.getByText(/My Custom List/)).toBeInTheDocument();
        });

        it('renders cancel and delete buttons', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} />);

            expect(screen.getByRole('button', { name: 'privateListManager.buttons.cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'privateListManager.buttons.delete' })).toBeInTheDocument();
        });
    });

    describe('Normal List Deletion', () => {
        it('enables delete button for non-system lists', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            expect(deleteButton).not.toBeDisabled();
        });

        it('calls onConfirm when delete button is clicked', () => {
            const onConfirm = jest.fn();
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} onConfirm={onConfirm} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            fireEvent.click(deleteButton);

            expect(onConfirm).toHaveBeenCalledTimes(1);
        });

        it('does not show system list warning for normal lists', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} />);

            expect(screen.queryByText('privateListManager.lists.cannotDeleteSystem')).not.toBeInTheDocument();
        });
    });

    describe('System List Protection', () => {
        it('shows warning message for system lists', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={systemList} />);

            expect(screen.getByText('privateListManager.lists.cannotDeleteSystem')).toBeInTheDocument();
        });

        it('disables delete button for system lists', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={systemList} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            expect(deleteButton).toBeDisabled();
        });

        it('does not call onConfirm when delete button is clicked on system list', () => {
            const onConfirm = jest.fn();
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={systemList} onConfirm={onConfirm} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            // Button is disabled, but try to click anyway
            fireEvent.click(deleteButton);

            expect(onConfirm).not.toHaveBeenCalled();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when cancel button is clicked', () => {
            const onClose = jest.fn();
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} onClose={onClose} />);

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            fireEvent.click(cancelButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Loading State', () => {
        it('disables cancel button when loading', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} loading={true} />);

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            expect(cancelButton).toBeDisabled();
        });

        it('disables delete button when loading', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={normalList} loading={true} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            expect(deleteButton).toBeDisabled();
        });

        it('keeps delete button disabled for system list even when not loading', () => {
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={systemList} loading={false} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            expect(deleteButton).toBeDisabled();
        });
    });

    describe('Edge Cases', () => {
        it('handles list without is_system_list property', () => {
            const listWithoutFlag = { list_name: 'Test List' };
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={listWithoutFlag} />);

            const deleteButton = screen.getByRole('button', { name: 'privateListManager.buttons.delete' });
            expect(deleteButton).not.toBeDisabled();
        });

        it('handles list with special characters in name', () => {
            const specialList = { list_name: 'List with <special> & "char\'s"', is_system_list: false };
            render(<DeleteConfirmationDialog {...defaultProps} open={true} list={specialList} />);

            expect(screen.getByText(/List with <special> & "char's"/)).toBeInTheDocument();
        });
    });
});
