import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import DuplicateManagement from '../DuplicateManagement';
import i18n from '../../../../../i18n';

// Mock fetch
global.fetch = jest.fn();

const mockCurrentUser = {
    id: 1,
    username: 'admin',
    role: 'root_admin'
};

const mockDuplicates = [
    {
        phrase_text: 'test phrase',
        count: 2,
        duplicates: [
            {
                id: 1,
                phrase: 'test phrase',
                translation: 'test translation 1',
                categories: 'category1 category2'
            },
            {
                id: 2,
                phrase: 'test phrase',
                translation: 'test translation 2',
                categories: 'category3 category4'
            }
        ]
    }
];

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('DuplicateManagement', () => {
    beforeEach(() => {
        fetch.mockClear();
        mockLocalStorage.getItem.mockClear();
    });

    const renderComponent = (selectedLanguageSetId = 1) => {
        return render(
            <I18nextProvider i18n={i18n}>
                <DuplicateManagement 
                    currentUser={mockCurrentUser} 
                    selectedLanguageSetId={selectedLanguageSetId}
                />
            </I18nextProvider>
        );
    };

    it('renders duplicate management interface for root admin', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                duplicates: mockDuplicates,
                total_count: 1,
                total_pages: 1,
                current_page: 1
            })
        });

        renderComponent();

        expect(screen.getByText('Duplicate Management')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.getByText('Found 1 groups of duplicate phrases.')).toBeInTheDocument();
        });
    });

    it('shows access denied for non-root admin', () => {
        const nonRootUser = { username: 'testuser', role: 'admin' };

        render(
            <I18nextProvider i18n={i18n}>
                <DuplicateManagement 
                    currentUser={nonRootUser} 
                    selectedLanguageSetId={1}
                />
            </I18nextProvider>
        );

        expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('prompts to select language set when none selected', () => {
        renderComponent(null);

        expect(screen.getByText(/Please select a language set first/)).toBeInTheDocument();
    });

    it('displays duplicates when loaded', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                duplicates: mockDuplicates,
                total_count: 1,
                total_pages: 1,
                current_page: 1
            })
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Found 1 groups of duplicate phrases.')).toBeInTheDocument();
            expect(screen.getAllByText('test phrase')[0]).toBeInTheDocument();
            expect(screen.getByText('test translation 1')).toBeInTheDocument();
            expect(screen.getByText('test translation 2')).toBeInTheDocument();
        });
    });

    it('displays no duplicates message when none found', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                duplicates: [],
                total_count: 0,
                total_pages: 0,
                current_page: 1
            })
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('No duplicate phrases found in this language set.')).toBeInTheDocument();
        });
    });

    it('can refresh duplicates', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    duplicates: mockDuplicates,
                    total_count: 1,
                    total_pages: 1,
                    current_page: 1
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    duplicates: [],
                    total_count: 0,
                    total_pages: 0,
                    current_page: 1
                })
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Found 1 groups of duplicate phrases.')).toBeInTheDocument();
        });

        const refreshButton = screen.getByText('Refresh');
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(screen.getByText('No duplicate phrases found in this language set.')).toBeInTheDocument();
        });
    });

    it('displays duplicates when loaded', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                duplicates: mockDuplicates,
                total_count: 1,
                total_pages: 1,
                current_page: 1
            })
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Found 1 groups of duplicate phrases.')).toBeInTheDocument();
            expect(screen.getAllByText('test phrase')[0]).toBeInTheDocument();
            expect(screen.getByText('test translation 1')).toBeInTheDocument();
            expect(screen.getByText('test translation 2')).toBeInTheDocument();
        });
    });

    it('handles error when loading duplicates fails', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText(/Failed to load duplicates:/)).toBeInTheDocument();
        });
    });
});
