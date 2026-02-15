import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BatchImportDialog from '../BatchImportDialog';

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, defaultValue) => defaultValue || key,
    }),
}));

describe('BatchImportDialog Component', () => {
    const defaultProps = {
        open: false,
        onClose: jest.fn(),
        onImport: jest.fn(),
        onFileSelect: jest.fn(),
        loading: false,
        importFile: null,
        importData: [],
        importPreview: [],
        importResult: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('does not render when open is false', () => {
            render(<BatchImportDialog {...defaultProps} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open is true', () => {
            render(<BatchImportDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('renders file select button', () => {
            render(<BatchImportDialog {...defaultProps} open={true} />);
            expect(screen.getByRole('button', { name: /Select File/i })).toBeInTheDocument();
        });

        it('renders import description', () => {
            render(<BatchImportDialog {...defaultProps} open={true} />);
            expect(screen.getByText(/phrase; translation; categories/i)).toBeInTheDocument();
        });
    });

    describe('File Selection', () => {
        it('shows selected file name and count', () => {
            const file = { name: 'test.csv' };
            const importData = [
                { phrase: 'Hello', translation: 'Hola', categories: '' },
                { phrase: 'Goodbye', translation: 'Adiós', categories: '' },
            ];

            render(<BatchImportDialog {...defaultProps} open={true} importFile={file} importData={importData} />);

            expect(screen.getByText(/test.csv/i)).toBeInTheDocument();
            expect(screen.getAllByText(/2 phrases/i).length).toBeGreaterThan(0);
        });

        it('calls onFileSelect when file is selected', () => {
            const onFileSelect = jest.fn();
            render(<BatchImportDialog {...defaultProps} open={true} onFileSelect={onFileSelect} />);

            const input = screen.getByRole('button', { name: /Select File/i }).querySelector('input[type="file"]');
            const file = new File(['phrase;translation'], 'test.csv', { type: 'text/csv' });

            fireEvent.change(input, { target: { files: [file] } });

            expect(onFileSelect).toHaveBeenCalled();
        });
    });

    describe('Import Preview', () => {
        const previewData = [
            { phrase: 'Hello', translation: 'Hola', categories: 'greetings' },
            { phrase: 'Goodbye', translation: 'Adiós', categories: 'greetings' },
            { phrase: 'Thank you', translation: 'Gracias', categories: '' },
        ];

        it('shows preview table when data available', () => {
            render(<BatchImportDialog {...defaultProps} open={true} importPreview={previewData} />);

            expect(screen.getByText(/Preview/i)).toBeInTheDocument();
            expect(screen.getByText('Hello')).toBeInTheDocument();
            expect(screen.getByText('Hola')).toBeInTheDocument();
        });

        it('displays categories or dash for empty categories', () => {
            render(<BatchImportDialog {...defaultProps} open={true} importPreview={previewData} />);

            // Check table has data (greetings appears twice, use getAll)
            expect(screen.getAllByText('greetings').length).toBeGreaterThan(0);
            expect(screen.getAllByText('-').length).toBeGreaterThan(0);
        });

        it('does not show preview when no data', () => {
            render(<BatchImportDialog {...defaultProps} open={true} importPreview={[]} />);

            expect(screen.queryByText(/Preview/i)).not.toBeInTheDocument();
        });
    });

    describe('Import Results', () => {
        it('shows success message when no errors', () => {
            const result = { added_count: 5, error_count: 0, errors: [] };
            render(<BatchImportDialog {...defaultProps} open={true} importResult={result} />);

            expect(screen.getByText(/Imported: 5/i)).toBeInTheDocument();
            expect(screen.getByText(/Errors: 0/i)).toBeInTheDocument();
        });

        it('shows warning when errors present', () => {
            const result = {
                added_count: 3, error_count: 2, errors: [
                    { index: 0, error: 'Missing translation' },
                    { index: 5, error: 'Invalid format' },
                ]
            };
            render(<BatchImportDialog {...defaultProps} open={true} importResult={result} />);

            expect(screen.getByText(/Imported: 3/i)).toBeInTheDocument();
            expect(screen.getByText(/Errors: 2/i)).toBeInTheDocument();
            expect(screen.getByText(/Row 1: Missing translation/i)).toBeInTheDocument();
            expect(screen.getByText(/Row 6: Invalid format/i)).toBeInTheDocument();
        });
    });

    describe('Import Functionality', () => {
        it('disables import button when no data', () => {
            render(<BatchImportDialog {...defaultProps} open={true} importData={[]} />);

            const importButton = screen.getByText(/Import 0 Phrases/i);
            expect(importButton).toBeDisabled();
        });

        it('enables import button when data available', () => {
            const importData = [{ phrase: 'Hello', translation: 'Hola', categories: '' }];
            render(<BatchImportDialog {...defaultProps} open={true} importData={importData} />);

            const importButton = screen.getByText(/Import 1 Phrases/i);
            expect(importButton).not.toBeDisabled();
        });

        it('calls onImport when import button clicked', () => {
            const onImport = jest.fn();
            const importData = [{ phrase: 'Hello', translation: 'Hola', categories: '' }];
            render(<BatchImportDialog {...defaultProps} open={true} importData={importData} onImport={onImport} />);

            const importButton = screen.getByText(/Import 1 Phrases/i);
            fireEvent.click(importButton);

            expect(onImport).toHaveBeenCalledTimes(1);
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button clicked', () => {
            const onClose = jest.fn();
            render(<BatchImportDialog {...defaultProps} open={true} onClose={onClose} />);

            const closeButton = screen.getByRole('button', { name: /Close/i });
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
