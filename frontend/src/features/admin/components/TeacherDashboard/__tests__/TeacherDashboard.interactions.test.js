
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeacherDashboard from '../TeacherDashboard';
import { useTeacherApi } from '../useTeacherApi';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (typeof options === 'string') return options;
            if (options?.defaultValue) {
                let val = options.defaultValue;
                if (options.count !== undefined) {
                    val = val.replace('{{count}}', options.count);
                }
                return val;
            }
            return key;
        }
    }),
}));

// Mock child components
jest.mock('../CreatePhraseSetDialog', () => ({
    __esModule: true,
    default: ({ open }) => open ? <div role="dialog" data-testid="create-phrase-set-dialog" /> : null
}));
jest.mock('../SessionListDialog', () => ({
    __esModule: true,
    default: ({ open }) => open ? <div role="dialog" data-testid="session-list-dialog" /> : null
}));
jest.mock('../PreviewDialog', () => ({
    __esModule: true,
    default: ({ open }) => open ? <div role="dialog" data-testid="preview-dialog" /> : null
}));

// Mock the API hook
jest.mock('../useTeacherApi', () => ({
    useTeacherApi: jest.fn()
}));



describe('TeacherDashboard Interactions', () => {
    // Suppress noisy React act() warnings in console output
    const originalConsoleError = console.error;
    beforeAll(() => {
        console.error = (...args) => {
            const first = args[0];
            if (typeof first === 'string' && first.includes('not wrapped in act(...)')) {
                return; // suppress noisy act() warning for this suite
            }
            originalConsoleError(...args);
        };
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });

    // Define mock functions here so they are fresh for each test if needed, 
    // or keep them describing the shape.
    const mockFetchPhraseSets = jest.fn();
    const mockCreatePhraseSet = jest.fn();
    const mockDeletePhraseSet = jest.fn();
    const mockRegenerateLink = jest.fn();
    const mockGetShareableLink = jest.fn((token) => `http://localhost/t/${token}`);
    const mockCopyLinkToClipboard = jest.fn();

    const mockApi = {
        isLoading: false,
        fetchPhraseSets: mockFetchPhraseSets,
        createPhraseSet: mockCreatePhraseSet,
        deletePhraseSet: mockDeletePhraseSet,
        regenerateLink: mockRegenerateLink,
        getShareableLink: mockGetShareableLink,
        copyLinkToClipboard: mockCopyLinkToClipboard,
    };

    const mockSets = [
        {
            id: 1,
            name: 'Test Set 1',
            phrase_count: 5,
            session_count: 2,
            current_hotlink_token: 'token1',
            access_type: 'public',
        },
        {
            id: 2,
            name: 'Test Set 2',
            phrase_count: 10,
            session_count: 0,
            current_hotlink_token: 'token2',
            access_type: 'private',
        },
    ];

    const mockLanguageSets = [
        { id: 1, name: 'English' },
        { id: 2, name: 'Spanish' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup the hook mock to return our mockApi object
        useTeacherApi.mockReturnValue(mockApi);

        // Reset default implementations
        mockFetchPhraseSets.mockResolvedValue({ sets: mockSets, total: 2 });
        mockDeletePhraseSet.mockResolvedValue({});
        mockCreatePhraseSet.mockResolvedValue({});
        mockRegenerateLink.mockResolvedValue({ token: 'new-token', version: 2 });
        mockCopyLinkToClipboard.mockResolvedValue({});
    });

    test('opens create dialog when "Create Puzzle" is clicked', async () => {
        render(
            <TeacherDashboard
                token="test-token"
                languageSets={mockLanguageSets}
                currentLanguageSetId={1}
            />
        );

        // Wait for initial load to complete before proceeding
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Click create button (there might be two, one in header, one in empty state if empty)
        // Since we possess data, there is one in header.
        const createButtons = screen.getAllByText('Create Puzzle');
        fireEvent.click(createButtons[0]);

        // Dialog should be open - we look for dialog title or content
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Since CreatePhraseSetDialog is a complex component, we just check if it renders
        // In a real integration test we might want to fill it out, but that tests the Dialog interacting with the Dashboard
    });

    test('opens delete confirmation dialog and deletes item', async () => {
        render(
            <TeacherDashboard
                token="test-token"
                languageSets={mockLanguageSets}
                currentLanguageSetId={1}
            />
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Find delete button for first item
        // The delete button has text "Delete" or icon.
        // We can use getAllByText('Delete') but that might include the confirm button in dialog if already open (it's not).
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);

        // Confirm dialog should appear
        expect(screen.getByText('Delete Puzzle?')).toBeInTheDocument();
        expect(screen.getByText(/Test Set 1/)).toBeInTheDocument();

        // Click confirm
        const confirmButton = screen.getByRole('button', { name: 'Delete' }); // In the dialog
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockDeletePhraseSet).toHaveBeenCalledWith(1);
        });

        // Item should be removed from view
        // We need to wait for state update.
        await waitFor(() => {
            expect(screen.queryByText('Test Set 1')).not.toBeInTheDocument();
        });
    });

    test('copies link to clipboard', async () => {
        const user = userEvent.setup();
        render(
            <TeacherDashboard
                token="test-token"
                languageSets={mockLanguageSets}
                currentLanguageSetId={1}
            />
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Test Set 1')).toBeInTheDocument();
        });

        const copyButtons = screen.getAllByRole('button', { name: 'Copy link' });
        await user.click(copyButtons[0]);

        expect(mockCopyLinkToClipboard).toHaveBeenCalledWith('token1');
        // Snack bar should appear
        expect(await screen.findByText('Link copied to clipboard!')).toBeInTheDocument();
    });

    test('opens sessions dialog when "Sessions" is clicked', async () => {
        render(
            <TeacherDashboard
                token="test-token"
                languageSets={mockLanguageSets}
                currentLanguageSetId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Test Set 1')).toBeInTheDocument();
        });

        const sessionsButtons = screen.getAllByText('Sessions');
        fireEvent.click(sessionsButtons[0]);

        // We expect SessionListDialog to open.
        // Since we didn't mock the dialogs, we expect some content from it to be visible.
        // SessionListDialog likely has a title "Sessions" or similar.
        // Let's assume it renders a Dialog.
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
