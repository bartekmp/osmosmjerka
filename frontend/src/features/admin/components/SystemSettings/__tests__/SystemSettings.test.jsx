import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock axios
jest.mock('axios', () => ({
    get: jest.fn(),
    put: jest.fn()
}));

const axios = require('axios');

describe('SystemSettings', () => {
    beforeEach(() => {
        fetch.mockClear();
        axios.get.mockClear();
        axios.put.mockClear();
        mockLocalStorage.getItem.mockClear();
        
        // Default successful responses
        axios.get.mockImplementation((url) => {
            if (url.includes('scoring')) {
                return Promise.resolve({ data: { enabled: true } });
            }
            if (url.includes('progressive-hints')) {
                return Promise.resolve({ data: { enabled: false } });
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
            expect(switches).toHaveLength(3);
        });

        // Check that axios.get was called for all settings
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/scoring', {
            headers: { 'Authorization': 'Bearer mock-token' }
        });
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/progressive-hints', {
            headers: { 'Authorization': 'Bearer mock-token' }
        });
        expect(axios.get).toHaveBeenCalledWith('/admin/settings/statistics', {
            headers: { 'Authorization': 'Bearer mock-token' }
        });
    });
});