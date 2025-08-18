import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import SystemSettings from '../../SystemSettings/SystemSettings';
import i18n from '../../../../../i18n';

// Mock fetch
global.fetch = jest.fn();

// Mock axios
jest.mock('axios', () => ({
    get: jest.fn(),
    put: jest.fn()
}));

const axios = require('axios');

const mockSystemSettings = {
    progressive_hints_enabled: true,
    max_game_time: 300,
    word_selection_algorithm: 'random'
};

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('SystemSettings', () => {
    beforeEach(() => {
        fetch.mockClear();
        axios.get.mockClear();
        axios.put.mockClear();
        mockLocalStorage.getItem.mockClear();
    });

    const renderComponent = () => {
        return render(
            <I18nextProvider i18n={i18n}>
                <SystemSettings />
            </I18nextProvider>
        );
    };

    it('renders system settings interface', async () => {
        axios.get.mockResolvedValue({
            data: { enabled: true }
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
            expect(screen.getByText('Progressive Hints')).toBeInTheDocument();
        });
    });

    it('handles loading error', async () => {
        axios.get.mockRejectedValue(new Error('Network error'));

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('common.loading')).toBeInTheDocument();
        });
    });
});
