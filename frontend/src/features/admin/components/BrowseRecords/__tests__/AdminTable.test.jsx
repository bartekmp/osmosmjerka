/* global HTMLCanvasElement */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AdminTable from '../AdminTable';
import { withI18n } from '../../../../../testUtils';

const theme = createTheme({
    palette: {
        mode: 'light'
    }
});

const renderAdminTable = (props = {}) => {
    const defaultProps = {
        rows: [{ id: 1, categories: 'greetings', phrase: 'hello', translation: 'hi' }],
        onSaveRow: jest.fn(),
        onDeleteRow: jest.fn(),
        totalRows: 1,
        searchTerm: '',
        onSearchChange: jest.fn(),
        isLoading: false,
        batchMode: false,
        selectedRows: [],
        onRowSelectionChange: jest.fn(),
        onBatchModeToggle: jest.fn(),
        onAddNewRow: jest.fn(),
        canAddNewRow: true,
        categoryOptions: ['greetings', 'animals', 'objects'],
        ...props
    };

    return render(withI18n(
        <ThemeProvider theme={theme}>
            <AdminTable {...defaultProps} />
        </ThemeProvider>
    ));
};

beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        measureText: () => ({ width: 50 })
    }));
});

describe('AdminTable inline add row', () => {
    test('renders inline editor for a new row and handles actions', async () => {
        const handleChange = jest.fn();
        const handleConfirm = jest.fn();
        const handleCancel = jest.fn();

        renderAdminTable({
            newRow: { categories: 'greetings', phrase: 'hello', translation: 'hi' },
            onNewRowChange: handleChange,
            onConfirmNewRow: handleConfirm,
            onCancelNewRow: handleCancel,
            isSavingNewRow: false
        });

        const categoriesInput = await screen.findByPlaceholderText(/categories/i);

        fireEvent.change(categoriesInput, { target: { value: 'animals' } });
        fireEvent.keyDown(categoriesInput, { key: ' ', code: 'Space', charCode: 32 });
        expect(handleChange).toHaveBeenCalledWith('categories', 'greetings animals');

        const addButton = screen.getByRole('button', { name: /^add$/i });
        expect(addButton).toBeEnabled();
        fireEvent.click(addButton);
        expect(handleConfirm).toHaveBeenCalled();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    await waitFor(() => expect(handleCancel).toHaveBeenCalled());
    });

    test('toolbar add row button is disabled when new row is active', () => {
        const handleAdd = jest.fn();
        renderAdminTable({
            onAddNewRow: handleAdd,
            newRow: { categories: '', phrase: '', translation: '' }
        });

        const toolbarAddButton = screen.getByRole('button', { name: /add row/i });
        expect(toolbarAddButton).toBeDisabled();
    });

    test('toolbar add row button triggers callback when enabled', () => {
        const handleAdd = jest.fn();
        renderAdminTable({
            onAddNewRow: handleAdd,
            canAddNewRow: true
        });

        const toolbarAddButton = screen.getByRole('button', { name: /add row/i });
        expect(toolbarAddButton).toBeEnabled();
        fireEvent.click(toolbarAddButton);
        expect(handleAdd).toHaveBeenCalled();
    });
});
