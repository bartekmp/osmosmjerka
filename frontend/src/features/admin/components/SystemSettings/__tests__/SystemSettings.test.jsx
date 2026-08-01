import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import SystemSettings from '../../SystemSettings/SystemSettings';
import i18n from '../../../../../i18n';

// Mock fetch
global.fetch = jest.fn();

const mockCurrentUser = {
    id: 1,
    username: 'root',
    role: 'root_admin'
};

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// SystemSettings talks to the shared API client; the interceptor supplies auth.
jest.mock('@shared/utils/apiClient', () => ({
    __esModule: true,
    default: { get: jest.fn(), put: jest.fn(), post: jest.fn() },
    getAuthToken: () => globalThis.localStorage.getItem('adminToken'),
    authHeaders: (extra = {}) => ({ ...extra }),
}));

const axios = require('@shared/utils/apiClient').default;

describe('SystemSettings', () => {
    beforeEach(() => {
        fetch.mockClear();
        axios.get.mockClear();
        axios.put.mockClear();
        axios.post.mockClear();
        mockLocalStorage.getItem.mockClear();
        
        // Default successful responses
        axios.get.mockImplementation((url) => {
            if (url.includes('email-templates')) {
                return Promise.resolve({
                    data: {
                        templates: {
                            verification: {
                                subject: 'Confirm your account',
                                body: 'Hi {{name}}, confirm: {{link}}',
                                placeholders: ['app_name', 'email', 'expiry_hours', 'link', 'name'],
                                is_default: true,
                            },
                        },
                        smtp_configured: true,
                        from_address: 'no-reply@example.com',
                    },
                });
            }
            return Promise.resolve({ data: { enabled: false } });
        });
    });

    const renderComponent = () => {
        const mockOnDashboard = jest.fn();
        return render(
            <I18nextProvider i18n={i18n}>
                <SystemSettings currentUser={mockCurrentUser} onDashboard={mockOnDashboard} />
            </I18nextProvider>
        );
    };

    it('renders system settings form', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
            expect(screen.getByText('Configure global system features and data collection settings. These settings affect all users.')).toBeInTheDocument();
            expect(screen.getByText('Game Features')).toBeInTheDocument();
        });
    });

    it('loads and displays current settings', async () => {
        renderComponent();

        await waitFor(() => {
            const switches = screen.getAllByRole('switch');
            expect(switches).toHaveLength(4);
        });

        // The Authorization header now comes from apiClient's interceptor, which has its
        // own tests, so these only assert the URLs that get requested.
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/progressive-hints');
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/statistics');
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/registration');
    });

    it('shows the registration toggle and saves a change to it', async () => {
        axios.put.mockResolvedValue({ data: { enabled: true } });
        renderComponent();

        await screen.findByText('Self-service registration');
        const registrationSwitch = screen
            .getByText('Self-service registration')
            .closest('label')
            .querySelector('input[type="checkbox"]');

        await userEvent.click(registrationSwitch);

        await waitFor(() =>
            expect(axios.put).toHaveBeenCalledWith('/admin/settings/registration', { enabled: true })
        );
    });

    it('renders the email template editor', async () => {
        renderComponent();

        await screen.findByText('Email templates');
        expect(screen.getByDisplayValue('Confirm your account')).toBeInTheDocument();
        expect(screen.getByText('{{link}}')).toBeInTheDocument();
    });
});