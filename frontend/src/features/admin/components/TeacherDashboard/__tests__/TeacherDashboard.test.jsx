import { render, screen } from '@testing-library/react';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    ...jest.requireActual('react-i18next'),
    useTranslation: () => ({ t: (key, _) => key })
}));

import apiClient from '@shared/utils/apiClient';
import TeacherDashboard from '../TeacherDashboard';

jest.mock('@shared/utils/apiClient', () => ({
    __esModule: true,
    default: { request: jest.fn() },
}));

describe('TeacherDashboard', () => {
    // Suppress noisy React act() warnings in console output
    const originalConsoleError = console.error;
    beforeAll(() => {
        console.error = (...args) => {
            const first = args[0];
            if (typeof first === 'string' && first.includes('not wrapped in act(...)')) {
                return;
            }
            originalConsoleError(...args);
        };
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: jest.fn(() => Promise.resolve()),
            },
            writable: true,
        });
        // Setup default fetch mock
        apiClient.request.mockResolvedValue({ data: { sets: [], total: 0 } });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders loading state initially', () => {
        render(<TeacherDashboard token="test-token" languageSets={[]} currentLanguageSetId={1} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('loads phrase sets on mount', () => {
        render(<TeacherDashboard token="test-token" languageSets={[]} currentLanguageSetId={1} />);

        // The Authorization header now comes from apiClient's interceptor, which has its
        // own tests; here we only assert the dashboard issues the request.
        expect(apiClient.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/admin/teacher/phrase-sets'),
            })
        );
    });

    test('renders without crashing with props', () => {
        const { container } = render(
            <TeacherDashboard
                token="test-token"
                languageSets={[{ id: 1, name: 'Spanish' }]}
                currentLanguageSetId={1}
            />
        );
        expect(container).toBeInTheDocument();
    });

});
