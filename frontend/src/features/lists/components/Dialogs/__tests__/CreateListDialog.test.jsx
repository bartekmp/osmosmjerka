import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateListDialog from '../CreateListDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

describe('CreateListDialog Component', () => {
    const defaultProps = {
        open: false,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        loading: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('does not render when open is false', () => {
            render(<CreateListDialog {...defaultProps} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('privateListManager.lists.createNew')).toBeInTheDocument();
        });

        it('renders text input field', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('maxlength', '100');
        });

        it('renders cancel and create buttons', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            expect(screen.getByRole('button', { name: 'privateListManager.buttons.cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'privateListManager.buttons.create' })).toBeInTheDocument();
        });
    });

    describe('User Input', () => {
        it('updates input value when typing', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'My New List' } });

            expect(input).toHaveValue('My New List');
        });

        it('respects max length of 100 characters', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            expect(input).toHaveAttribute('maxlength', '100');
        });
    });

    describe('Submit Functionality', () => {
        it('disables create button when input is empty', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            expect(createButton).toBeDisabled();
        });

        it('disables create button when input contains only whitespace', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: '   ' } });

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            expect(createButton).toBeDisabled();
        });

        it('enables create button when input has valid text', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'Valid List Name' } });

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            expect(createButton).not.toBeDisabled();
        });

        it('calls onSubmit with list name when create button is clicked', () => {
            const onSubmit = jest.fn();
            render(<CreateListDialog {...defaultProps} open={true} onSubmit={onSubmit} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'My List' } });

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            fireEvent.click(createButton);

            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(onSubmit).toHaveBeenCalledWith('My List');
        });

        it('resets input after successful submit', () => {
            render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'My List' } });

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            fireEvent.click(createButton);

            expect(input).toHaveValue('');
        });

        it('submits on Enter key press when input is valid', () => {
            const onSubmit = jest.fn();
            render(<CreateListDialog {...defaultProps} open={true} onSubmit={onSubmit} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'My List' } });
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });

            expect(onSubmit).toHaveBeenCalledTimes(1);
            expect(onSubmit).toHaveBeenCalledWith('My List');
        });

        it('does not submit on Enter when input is empty', () => {
            const onSubmit = jest.fn();
            render(<CreateListDialog {...defaultProps} open={true} onSubmit={onSubmit} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });

            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when cancel button is clicked', () => {
            const onClose = jest.fn();
            render(<CreateListDialog {...defaultProps} open={true} onClose={onClose} />);

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            fireEvent.click(cancelButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('resets input when dialog is closed', () => {
            const { rerender } = render(<CreateListDialog {...defaultProps} open={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            fireEvent.change(input, { target: { value: 'Some Text' } });

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            fireEvent.click(cancelButton);

            // Reopen dialog
            rerender(<CreateListDialog {...defaultProps} open={false} />);
            rerender(<CreateListDialog {...defaultProps} open={true} />);

            expect(input).toHaveValue('');
        });
    });

    describe('Loading State', () => {
        it('disables input when loading', () => {
            render(<CreateListDialog {...defaultProps} open={true} loading={true} />);

            const input = screen.getByLabelText('privateListManager.lists.listName');
            expect(input).toBeDisabled();
        });

        it('disables cancel button when loading', () => {
            render(<CreateListDialog {...defaultProps} open={true} loading={true} />);

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            expect(cancelButton).toBeDisabled();
        });

        it('disables create button when loading', () => {
            render(<CreateListDialog {...defaultProps} open={true} loading={true} />);

            const createButton = screen.getByRole('button', { name: 'privateListManager.buttons.create' });
            expect(createButton).toBeDisabled();
        });
    });
});
