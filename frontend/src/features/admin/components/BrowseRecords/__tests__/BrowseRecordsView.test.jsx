
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BrowseRecordsView from '../BrowseRecordsView';

// Mock sub-components to isolate tests
jest.mock('../AdminTable', () => () => <div data-testid="admin-table">Admin Table</div>);
jest.mock('../BatchOperationDialog', () => () => <div data-testid="batch-operation-dialog" />);
jest.mock('../BatchResultDialog', () => () => <div data-testid="batch-result-dialog" />);
jest.mock('../BatchOperationsToolbar', () => () => <div data-testid="batch-toolbar" />);
jest.mock('../PaginationControls', () => () => <div data-testid="pagination-controls" />);

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe('BrowseRecordsView', () => {
    const mockProps = {
        rows: [],
        totalRows: 0,
        loading: false,
        error: null,

        offset: 0,
        limit: 10,
        setOffset: jest.fn(),
        setLimit: jest.fn(),
        offsetInput: '1',
        handleOffsetInput: jest.fn(),
        goToOffset: jest.fn(),
        searchTerm: '',
        handleSearchChange: jest.fn(),

        languageSets: [
            { id: 1, display_name: 'Set 1' },
            { id: 2, display_name: 'Set 2' }
        ],
        selectedLanguageSetId: 1,
        setSelectedLanguageSetId: jest.fn(),
        categories: ['Cat1', 'Cat2'],
        filterCategory: '',
        setFilterCategory: jest.fn(),

        currentUser: { id: 1 },
        userIgnoredCategories: ['Ignored1'],
        ignoredCategories: [],
        toggleIgnoredCategory: jest.fn(),
        ignoredCategoriesCount: 1,
        showIgnoredCategories: true,

        batchMode: false,
        handleBatchModeToggle: jest.fn(),
        selectedRows: [],
        handleRowSelectionChange: jest.fn(),
        handleBatchDeleteClick: jest.fn(),
        handleBatchAddCategoryClick: jest.fn(),
        handleBatchRemoveCategoryClick: jest.fn(),
        batchLoading: false,

        batchDialog: { open: false },
        handleBatchDialogClose: jest.fn(),
        handleBatchConfirm: jest.fn(),
        batchResult: { open: false },
        handleBatchResultClose: jest.fn(),

        handleInlineSave: jest.fn(),
        handleInlineDelete: jest.fn(),
        handleStartAddRow: jest.fn(),
        newRow: null,
        handleNewRowFieldChange: jest.fn(),
        handleCancelNewRow: jest.fn(),
        handleConfirmNewRow: jest.fn(),
        isSavingNewRow: false,
        canAddNewRow: true,

        isControlBarCollapsed: false,
        isLayoutCompact: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders filter controls', () => {
        render(<BrowseRecordsView {...mockProps} />);

        // Since we use Material UI Select (TextField select), it renders an input and label
        // Labels are "filter_by_language_set" and "filter_by_category" (mocked t output)
        expect(screen.getByLabelText('filter_by_language_set')).toBeInTheDocument();
        expect(screen.getByLabelText('filter_by_category')).toBeInTheDocument();

        // Check language set options are present (in DOM but hidden until clicked for Select)
        // However, MUI Select options are not in DOM usually until clicked.
        // We can check the value of the input.
    });

    test('renders ignored categories section', () => {
        render(<BrowseRecordsView {...mockProps} />);

        expect(screen.getByText('your_ignored_categories')).toBeInTheDocument();
        expect(screen.getByText('Ignored1')).toBeInTheDocument();
    });

    test('calls setSelectedLanguageSetId when language changed', () => {
        render(<BrowseRecordsView {...mockProps} />);

        // Open language selector
        fireEvent.mouseDown(screen.getByLabelText('filter_by_language_set'));

        // Click option 2
        const option = screen.getByText('Set 2');
        fireEvent.click(option);

        expect(mockProps.setSelectedLanguageSetId).toHaveBeenCalledWith(2);
    });

    test('calls setFilterCategory when category changed', () => {
        render(<BrowseRecordsView {...mockProps} />);

        // Open category selector
        fireEvent.mouseDown(screen.getByLabelText('filter_by_category'));

        // Click option Cat1
        const option = screen.getByRole('option', { name: 'Cat1' });
        fireEvent.click(option);

        expect(mockProps.setFilterCategory).toHaveBeenCalledWith('Cat1');
        expect(mockProps.setOffset).toHaveBeenCalledWith(0); // Should reset offset
    });

    test('renders AdminTable and Pagination', () => {
        render(<BrowseRecordsView {...mockProps} />);

        expect(screen.getByTestId('admin-table')).toBeInTheDocument();
        expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
    });

    test('renders error message when error prop provided', () => {
        render(<BrowseRecordsView {...mockProps} error="Something went wrong" />);

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    test('renders batch toolbar when batch mode enabled', () => {
        render(<BrowseRecordsView {...mockProps} batchMode={true} />);

        expect(screen.getByTestId('batch-toolbar')).toBeInTheDocument();
    });

    test('toggles ignored category when chip clicked', () => {
        render(<BrowseRecordsView {...mockProps} />);

        const chip = screen.getByText('Ignored1');
        fireEvent.click(chip);

        expect(mockProps.toggleIgnoredCategory).toHaveBeenCalledWith('Ignored1');
    });
});
