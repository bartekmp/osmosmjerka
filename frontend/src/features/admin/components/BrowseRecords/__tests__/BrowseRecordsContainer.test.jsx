import React from 'react';
import { render, screen, act } from '@testing-library/react';
import BrowseRecordsContainer from '../BrowseRecordsContainer';

// Mock dependencies
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

// Mock useAdminApi
const mockUseAdminApi = {
    fetchRows: jest.fn(),
    handleSave: jest.fn(),
    handleExportTxt: jest.fn(),
    clearDb: jest.fn(),
    handleDelete: jest.fn(),
    handleBatchDelete: jest.fn(),
    handleBatchAddCategory: jest.fn(),
    handleBatchRemoveCategory: jest.fn(),
    invalidateCategoriesCache: jest.fn(),
    showFetchRateLimit: false
};

jest.mock('../../AdminPanel/useAdminApi', () => ({
    useAdminApi: jest.fn(() => mockUseAdminApi)
}));

// Mock View Component
jest.mock('../BrowseRecordsView', () => {
    return jest.fn((props) => (
        <div data-testid="browse-records-view">
            <button onClick={() => props.onReloadData()}>Reload</button>
            <button onClick={() => props.toggleIgnoredCategory('test-cat')}>Toggle Ignored</button>
            <span data-testid="rows-count">{props.rows.length}</span>
            <span data-testid="ignored-count">{props.ignoredCategoriesCount}</span>
        </div>
    ));
});

describe('BrowseRecordsContainer with mocked View', () => {
    const defaultProps = {
        token: 'test-token',
        currentUser: { id: 1, role: 'admin' },
        selectedLanguageSetId: 1,
        languageSets: [{ id: 1, name: 'Set 1' }],
        setSelectedLanguageSetId: jest.fn(),
        categories: ['A', 'B'],
        userIgnoredCategories: [],
        ignoredCategories: [],
        onUpdateUserIgnoredCategories: jest.fn(),
        setDashboard: jest.fn(),
        setToken: jest.fn(),
        setIsLogged: jest.fn(),
        isControlBarCollapsed: false,
        isLayoutCompact: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations if needed
    });

    it('renders and fetches rows on mount', () => {
        render(<BrowseRecordsContainer {...defaultProps} />);
        expect(mockUseAdminApi.fetchRows).toHaveBeenCalledWith(0, 20, '', '', 1);
        expect(screen.getByTestId('browse-records-view')).toBeInTheDocument();
    });

    it('does not fetch rows if no language set selected', () => {
        render(<BrowseRecordsContainer {...defaultProps} selectedLanguageSetId={null} />);
        expect(mockUseAdminApi.fetchRows).not.toHaveBeenCalled();
    });

    it('handles toggleIgnoredCategory', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            })
        );

        render(<BrowseRecordsContainer {...defaultProps} />);

        await act(async () => {
            screen.getByText('Toggle Ignored').click();
        });

        expect(global.fetch).toHaveBeenCalledWith('/api/user/ignored-categories', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({
                language_set_id: 1,
                categories: ['test-cat']
            })
        }));

        expect(defaultProps.onUpdateUserIgnoredCategories).toHaveBeenCalledWith(['test-cat']);
        // Should verify it triggers a re-fetch
        expect(mockUseAdminApi.fetchRows).toHaveBeenCalled();
    });
});
