import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddCustomPhraseDialog from '../AddCustomPhraseDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

describe('AddCustomPhraseDialog Component', () => {
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
            render(<AddCustomPhraseDialog {...defaultProps} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('renders all three input fields', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            expect(screen.getByLabelText('privateListManager.phrases.phrase')).toBeInTheDocument();
            expect(screen.getByLabelText('privateListManager.phrases.translation')).toBeInTheDocument();
            expect(screen.getByLabelText('privateListManager.phrases.categories')).toBeInTheDocument();
        });

        it('renders helper text for categories', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);
            expect(screen.getByText('privateListManager.phrases.categoriesHelp')).toBeInTheDocument();
        });
    });

    describe('Submit Validation', () => {
        it('disables add button when both fields empty', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);
            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            expect(addButton).toBeDisabled();
        });

        it('disables add button when only phrase filled', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            const phraseInput = screen.getByLabelText('privateListManager.phrases.phrase');
            fireEvent.change(phraseInput, { target: { value: 'Hello' } });

            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            expect(addButton).toBeDisabled();
        });

        it('disables add button when only translation filled', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            const translationInput = screen.getByLabelText('privateListManager.phrases.translation');
            fireEvent.change(translationInput, { target: { value: 'Hola' } });

            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            expect(addButton).toBeDisabled();
        });

        it('enables add button when both required fields filled', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            const phraseInput = screen.getByLabelText('privateListManager.phrases.phrase');
            const translationInput = screen.getByLabelText('privateListManager.phrases.translation');

            fireEvent.change(phraseInput, { target: { value: 'Hello' } });
            fireEvent.change(translationInput, { target: { value: 'Hola' } });

            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            expect(addButton).not.toBeDisabled();
        });
    });

    describe('Submit Functionality', () => {
        it('calls onSubmit with all values', () => {
            const onSubmit = jest.fn();
            render(<AddCustomPhraseDialog {...defaultProps} open={true} onSubmit={onSubmit} />);

            const phraseInput = screen.getByLabelText('privateListManager.phrases.phrase');
            const translationInput = screen.getByLabelText('privateListManager.phrases.translation');
            const categoriesInput = screen.getByLabelText('privateListManager.phrases.categories');

            fireEvent.change(phraseInput, { target: { value: 'Hello' } });
            fireEvent.change(translationInput, { target: { value: 'Hola' } });
            fireEvent.change(categoriesInput, { target: { value: 'greetings' } });

            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            fireEvent.click(addButton);

            expect(onSubmit).toHaveBeenCalledWith('Hello', 'Hola', 'greetings');
        });

        it('resets fields after submit', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            const phraseInput = screen.getByLabelText('privateListManager.phrases.phrase');
            const translationInput = screen.getByLabelText('privateListManager.phrases.translation');

            fireEvent.change(phraseInput, { target: { value: 'Hello' } });
            fireEvent.change(translationInput, { target: { value: 'Hola' } });

            const addButton = screen.getByRole('button', { name: 'privateListManager.buttons.add' });
            fireEvent.click(addButton);

            expect(phraseInput).toHaveValue('');
            expect(translationInput).toHaveValue('');
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when cancel clicked', () => {
            const onClose = jest.fn();
            render(<AddCustomPhraseDialog {...defaultProps} open={true} onClose={onClose} />);

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            fireEvent.click(cancelButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('resets fields on close', () => {
            const { rerender } = render(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            const phraseInput = screen.getByLabelText('privateListManager.phrases.phrase');
            fireEvent.change(phraseInput, { target: { value: 'Test' } });

            const cancelButton = screen.getByRole('button', { name: 'privateListManager.buttons.cancel' });
            fireEvent.click(cancelButton);

            rerender(<AddCustomPhraseDialog {...defaultProps} open={false} />);
            rerender(<AddCustomPhraseDialog {...defaultProps} open={true} />);

            expect(phraseInput).toHaveValue('');
        });
    });

    describe('Loading State', () => {
        it('disables all inputs when loading', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} loading={true} />);

            expect(screen.getByLabelText('privateListManager.phrases.phrase')).toBeDisabled();
            expect(screen.getByLabelText('privateListManager.phrases.translation')).toBeDisabled();
            expect(screen.getByLabelText('privateListManager.phrases.categories')).toBeDisabled();
        });

        it('disables buttons when loading', () => {
            render(<AddCustomPhraseDialog {...defaultProps} open={true} loading={true} />);

            expect(screen.getByRole('button', { name: 'privateListManager.buttons.cancel' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'privateListManager.buttons.add' })).toBeDisabled();
        });
    });
});
