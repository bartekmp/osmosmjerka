import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import UserProfile from '../UserProfile';
import i18n from '../../../../../i18n';

// Mock fetch
global.fetch = jest.fn();

const mockCurrentUser = {
    id: 1,
    username: 'testuser',
    role: 'admin'
};

const mockProfile = {
    username: 'testuser',
    role: 'admin',
    self_description: 'Test description'
};

const mockStatistics = {
    overall_statistics: {
        games_completed: 10,
        games_started: 15,
        total_phrases_found: 150,
        total_time_played_seconds: 3600
    },
    language_set_statistics: [
        {
            language_set_name: 'English',
            games_completed: 5,
            total_phrases_found: 75,
            total_time_played_seconds: 1800,
            last_played: '2023-12-01T00:00:00Z'
        }
    ]
};

const mockPreferences = {
    progressive_hints_enabled: 'true'
};

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('UserProfile', () => {
    beforeEach(() => {
        fetch.mockClear();
        mockLocalStorage.getItem.mockClear();
    });

    const renderComponent = () => {
        return render(
            <I18nextProvider i18n={i18n}>
                <UserProfile currentUser={mockCurrentUser} />
            </I18nextProvider>
        );
    };

    it('renders user profile information', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatistics
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('User Profile')).toBeInTheDocument();
            expect(screen.getByText('testuser')).toBeInTheDocument();
            expect(screen.getByText('admin')).toBeInTheDocument();
        });
    });

    it('displays statistics correctly', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatistics
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('10')).toBeInTheDocument(); // Games completed
            expect(screen.getByText('67%')).toBeInTheDocument(); // Completion rate
            expect(screen.getByText('150')).toBeInTheDocument(); // Total phrases found
            expect(screen.getByText('1h 0m')).toBeInTheDocument(); // Time played
        });
    });

    it('displays progressive hints setting', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatistics
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Progressive Hints Preference')).toBeInTheDocument();
            expect(screen.getByLabelText('Use global system setting')).toBeInTheDocument();
            expect(screen.getByLabelText('Enable progressive hints')).toBeInTheDocument();
            expect(screen.getByLabelText('Disable progressive hints')).toBeInTheDocument();
        });
    });

    it('can update progressive hints preference', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatistics
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: 'Preference updated successfully' })
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Enable progressive hints')).toBeChecked();
        });

        fireEvent.click(screen.getByLabelText('Disable progressive hints'));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    preference_key: 'progressive_hints_enabled',
                    preference_value: 'false'
                })
            });
        });
    });

    it('can update description', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStatistics
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: 'Description updated successfully' })
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
        });

        const descriptionField = screen.getByLabelText('Description');
        fireEvent.change(descriptionField, { target: { value: 'Updated description' } });

        const updateButton = screen.getByText('Update Description');
        fireEvent.click(updateButton);

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith('/admin/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    self_description: 'Updated description'
                })
            });
        });
    });

    it('handles statistics loading error', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Failed to load statistics' })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Error: Failed to load statistics')).toBeInTheDocument();
        });
    });

    it('displays no statistics message when no data available', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockProfile
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => []
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => null
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockPreferences
            });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('No statistics available')).toBeInTheDocument();
        });
    });
});
